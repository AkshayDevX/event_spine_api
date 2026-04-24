import { FastifyInstance } from "fastify";
import { handleWebhook } from "./webhook.controller";

export default async function webhookRoutes(app: FastifyInstance) {
  app.post(
    "/:webhookPath",
    {
      schema: {
        tags: ["webhooks"],
        description: "Ingest a webhook payload for a specific workflow",
        params: {
          type: "object",
          properties: {
            webhookPath: { type: "string" },
          },
        },
        body: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    handleWebhook,
  );
}
