import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../drizzle";
import { webhookPayloadSchema } from "./webhook.schema";

export async function handleWebhook(
  request: FastifyRequest<{ Params: { webhookPath: string } }>,
  reply: FastifyReply,
) {
  try {
    const { webhookPath } = request.params;
    const payload = webhookPayloadSchema.parse(request.body || {});

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

    // 2. Execute Steps Synchronously (Phase 1 MVP limitation)
    request.log.info(
      `[Webhook Recv] Workflow: ${workflow.name} | Steps: ${workflow.steps.length}`,
    );

    for (const step of workflow.steps) {
      request.log.info(
        `Executing step ${step.orderNumber} - Type: ${step.actionType}`,
      );

      request.log.info(
        JSON.stringify({ config: step.config, payload: payload }),
      );
    }

    return reply
      .status(200)
      .send({ success: true, message: "Webhook processed" });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(400).send({ message: err.message });
  }
}
