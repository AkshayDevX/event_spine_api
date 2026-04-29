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
        headers: {
          type: "object",
          properties: {
            "x-idempotency-key": {
              type: "string",
              description: "Unique key to prevent duplicate processing",
            },
            "idempotency-key": {
              type: "string",
              description: "Standard idempotency key",
            },
            "x-github-delivery": {
              type: "string",
              description: "GitHub unique delivery ID",
            },
          },
        },
        body: {
          type: "object",
          additionalProperties: true,
        },
        response: {
          202: {
            description: "Webhook accepted or duplicate ignored",
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              runId: { type: "string" },
              duplicate: { type: "boolean" },
            },
          },
          429: {
            description: "Rate limit exceeded",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    handleWebhook,
  );
}
