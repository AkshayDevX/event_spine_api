import { FastifyInstance } from "fastify";
import {
  createWorkflowHandler,
  getWorkflowHandler,
  listWorkflowsHandler,
} from "./workflow.controller";

export default async function workflowRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  app.post(
    "/",
    {
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "actionType", "config"],
          properties: {
            name: { type: "string" },
            triggerType: { type: "string", default: "webhook" },
            actionType: { type: "string" },
            config: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    createWorkflowHandler,
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }],
      },
    },
    listWorkflowsHandler,
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    getWorkflowHandler,
  );
}
