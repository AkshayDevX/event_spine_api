import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "../../../drizzle";
import {
  workflowRuns,
  workflowRunSteps,
} from "../../../drizzle/schema/workflow";
import { executeStep, FilterFailedError } from "../workflows/executor";
import { type StepConfig } from "../workflows/workflow.schema";
import { env } from "../../config/env";
import { QUEUE_NAME, type WebhookJobData } from "./queue";
import { logger } from "../../config/logger";
import { publishLiveEvent } from "./pubsub";

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const webhookWorker = new Worker<WebhookJobData, void, string>(
  QUEUE_NAME,
  async (job: Job<WebhookJobData>) => {
    const { runId, workflowId } = job.data;

    // Fetch the run, including the workflow, steps, and webhook event payload
    const run = await db.query.workflowRuns.findFirst({
      where: { id: runId },
      with: {
        workflow: {
          with: {
            steps: true,
          },
        },
        event: true,
      },
    });

    if (!run || !run.workflow || !run.event) {
      throw new Error(`Invalid run data for runId: ${runId}`);
    }

    const { workflow, event } = run;
    // ensure payload is an object, type it as Record<string, unknown>
    const payload = event.payload as Record<string, unknown>;

    // Mark run as running if it's pending
    if (run.status === "pending") {
      await db
        .update(workflowRuns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(workflowRuns.id, runId));

      await publishLiveEvent(workflowId, {
        type: "workflow.started",
        runId,
      });
    }

    // Execute each step in the correct order
    const sortedSteps = [...workflow.steps].sort(
      (a, b) => Number(a.orderNumber) - Number(b.orderNumber),
    );

    for (const step of sortedSteps) {
      // Idempotency: Check if step run already exists
      let stepRun = await db.query.workflowRunSteps.findFirst({
        where: {
          workflowRunId: runId,
          stepId: step.id,
        },
      });

      if (stepRun) {
        if (stepRun.status === "completed") {
          // Skip already completed steps
          continue;
        } else {
          // If failed, we update it to running
          [stepRun] = await db
            .update(workflowRunSteps)
            .set({
              status: "running",
              startedAt: new Date(),
              error: null, // Clear previous error
            })
            .where(eq(workflowRunSteps.id, stepRun.id))
            .returning();
        }
      } else {
        // Initialize step run
        [stepRun] = await db
          .insert(workflowRunSteps)
          .values({
            workflowRunId: runId,
            stepId: step.id,
            status: "running",
            startedAt: new Date(),
          })
          .returning();
      }

      try {
        logger.info(
          `[Job ${job.id}] Executing step ${step.orderNumber} - Type: ${step.actionType}`,
        );

        await publishLiveEvent(workflowId, {
          type: "step.running",
          runId,
          stepId: step.id,
          orderNumber: Number(step.orderNumber),
        });

        // Execute the real step logic
        const stepResult = await executeStep(
          step.actionType,
          step.config as StepConfig,
          payload,
        );

        // Mark step as completed
        await db
          .update(workflowRunSteps)
          .set({
            status: "completed",
            completedAt: new Date(),
            logs: stepResult,
          })
          .where(eq(workflowRunSteps.id, stepRun.id));

        await publishLiveEvent(workflowId, {
          type: "step.completed",
          runId,
          stepId: step.id,
          orderNumber: Number(step.orderNumber),
        });
      } catch (stepErr: unknown) {
        if (stepErr instanceof FilterFailedError) {
          // Filter failed - this is a graceful halt, not a system failure
          logger.warn(
            `[Job ${job.id}] Workflow halted by filter: ${stepErr.message}`,
          );
          await db
            .update(workflowRunSteps)
            .set({
              status: "halted",
              completedAt: new Date(),
              logs: { message: stepErr.message, filter_passed: false },
            })
            .where(eq(workflowRunSteps.id, stepRun.id));

          // Mark overall run as halted
          await db
            .update(workflowRuns)
            .set({ status: "halted", completedAt: new Date() })
            .where(eq(workflowRuns.id, runId));

          await publishLiveEvent(workflowId, {
            type: "workflow.halted",
            runId,
          });

          return; // Exit the entire job gracefully
        }

        // True step failure
        const errorMessage =
          stepErr instanceof Error ? stepErr.message : "Unknown step error";
        await db
          .update(workflowRunSteps)
          .set({
            status: "failed",
            completedAt: new Date(),
            error: errorMessage,
          })
          .where(eq(workflowRunSteps.id, stepRun.id));

        await publishLiveEvent(workflowId, {
          type: "step.failed",
          runId,
          stepId: step.id,
          orderNumber: Number(step.orderNumber),
          error: errorMessage,
        });

        throw new Error(`Step execution failed: ${errorMessage}`, {
          cause: stepErr,
        });
      }
    }

    // Mark overall run as completed
    await db
      .update(workflowRuns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(workflowRuns.id, runId));

    await publishLiveEvent(workflowId, {
      type: "workflow.completed",
      runId,
    });

    logger.info(
      `[Job ${job.id}] Workflow run ${runId} completed successfully.`,
    );
  },
  { connection },
);

webhookWorker.on("failed", async (job, err) => {
  if (job) {
    logger.error(`[Job ${job.id}] Failed with error: ${err.message}`);
    // Update the overall run to failed if it's the last attempt, or just let the step error reflect it
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      const { runId, workflowId } = job.data;
      await db
        .update(workflowRuns)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(workflowRuns.id, runId));

      await publishLiveEvent(workflowId, {
        type: "workflow.failed",
        runId,
        error: err.message,
      });
    }
  }
});
