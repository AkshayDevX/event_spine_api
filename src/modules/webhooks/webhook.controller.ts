import { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../drizzle";
import { eq } from "drizzle-orm";
import {
  webhookEvents,
  workflowRuns,
  workflowRunSteps,
} from "../../../drizzle/schema/workflow";
import {
  webhookPayloadSchema,
  type WebhookPayload,
  type WorkflowWithSteps,
} from "./webhook.schema";
import { executeStep, FilterFailedError } from "../workflows/executor";
import { type StepConfig } from "../workflows/workflow.schema";

export async function handleWebhook(
  request: FastifyRequest<{ Params: { webhookPath: string } }>,
  reply: FastifyReply,
) {
  try {
    const { webhookPath } = request.params;
    const payload = webhookPayloadSchema.parse(request.body || {});
    const headers = request.headers;

    // 1. Find the workflow associated with this webhookPath
    const workflow = await db.query.workflows.findFirst({
      where: {
        webhookPath,
      },
      with: {
        steps: true,
      },
    });

    if (!workflow || !workflow.isActive) {
      return reply
        .status(404)
        .send({ message: "Webhook endpoint not found or inactive" });
    }

    // 2. Insert Webhook Event
    const [event] = await db
      .insert(webhookEvents)
      .values({
        workflowId: workflow.id,
        payload,
        headers,
      })
      .returning();

    // 3. Initialize Workflow Run
    const [run] = await db
      .insert(workflowRuns)
      .values({
        workflowId: workflow.id,
        webhookEventId: event.id,
        status: "pending",
      })
      .returning();

    request.log.info(
      `[Webhook Recv] Workflow: ${workflow.name} | Run ID: ${run.id}`,
    );

    // 4. Detached Asynchronous Execution (Fire-and-Forget)
    // We do NOT await this promise!
    executeWorkflowRun(request.log, workflow, run.id, payload).catch((err) => {
      request.log.error(`Unhandled error in executeWorkflowRun: ${err}`);
    });

    // 5. Return 202 Accepted Immediately
    return reply.status(202).send({
      success: true,
      message: "Webhook accepted for processing",
      runId: run.id,
    });
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    return reply.status(400).send({ message });
  }
}

// Background Function for Asynchronous Execution
async function executeWorkflowRun(
  logger: FastifyBaseLogger,
  workflow: WorkflowWithSteps,
  runId: string,
  payload: WebhookPayload,
) {
  try {
    // Mark run as running
    await db
      .update(workflowRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(workflowRuns.id, runId));

    // Execute each step
    for (const step of workflow.steps) {
      // Initialize step run
      const [stepRun] = await db
        .insert(workflowRunSteps)
        .values({
          workflowRunId: runId,
          stepId: step.id,
          status: "running",
          startedAt: new Date(),
        })
        .returning();

      try {
        logger.info(
          `Executing step ${step.orderNumber} - Type: ${step.actionType}`,
        );

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
      } catch (stepErr: unknown) {
        if (stepErr instanceof FilterFailedError) {
          // Filter failed - this is a graceful halt, not a system failure
          logger.info(`Workflow halted by filter: ${stepErr.message}`);
          await db
            .update(workflowRunSteps)
            .set({
              status: "completed",
              completedAt: new Date(),
              logs: { message: stepErr.message, filter_passed: false },
            })
            .where(eq(workflowRunSteps.id, stepRun.id));

          // Mark overall run as completed (since it successfully ran, but was filtered)
          await db
            .update(workflowRuns)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(workflowRuns.id, runId));

          return; // Exit the entire executeWorkflowRun function gracefully
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

    logger.info(`Workflow run ${runId} completed successfully.`);
  } catch (runErr: unknown) {
    const errorMessage =
      runErr instanceof Error ? runErr.message : "Unknown error";
    logger.error(`Workflow run ${runId} failed: ${errorMessage}`);
    // Mark overall run as failed
    await db
      .update(workflowRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(workflowRuns.id, runId));
  }
}
