import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../drizzle";
import { webhookEvents, workflowRuns } from "../../../drizzle/schema/workflow";
import { webhookPayloadSchema } from "./webhook.schema";
import { webhookQueue } from "../queue/queue";
import {
  DuplicateWebhookError,
  enforceWebhookRateLimit,
  RateLimitExceededError,
  reserveIdempotencyKey,
} from "./ingress-guards";

function getHeaderValue(
  header: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(header)) return header[0];
  return header;
}

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

    const rateLimit = await enforceWebhookRateLimit({
      workspaceId: workflow.workspaceId,
      webhookPath,
    });

    const idempotencyKey =
      getHeaderValue(headers["x-idempotency-key"]) ||
      getHeaderValue(headers["idempotency-key"]) ||
      getHeaderValue(headers["x-github-delivery"]) ||
      (request.body as unknown as { id: string })?.id?.toString();

    if (idempotencyKey) {
      await reserveIdempotencyKey({
        workspaceId: workflow.workspaceId,
        webhookPath,
        idempotencyKey,
      });
    }

    reply.header("X-RateLimit-Limit", rateLimit.limit);
    reply.header("X-RateLimit-Remaining", rateLimit.remaining);

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

    // 4. Enqueue Asynchronous Execution via BullMQ
    await webhookQueue.add("process-workflow", {
      runId: run.id,
      workflowId: workflow.id,
    });

    // 5. Return 202 Accepted Immediately
    return reply.status(202).send({
      success: true,
      message: "Webhook accepted for processing",
      runId: run.id,
    });
  } catch (err: unknown) {
    if (err instanceof RateLimitExceededError) {
      return reply
        .status(429)
        .header("Retry-After", err.retryAfterSeconds)
        .send({ message: err.message });
    }

    if (err instanceof DuplicateWebhookError) {
      return reply.status(202).send({
        success: true,
        duplicate: true,
        message: err.message,
      });
    }

    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    return reply.status(400).send({ message });
  }
}
