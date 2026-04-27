import { FastifyInstance } from "fastify";
import {
  createWorkflowHandler,
  getWorkflowHandler,
  listWorkflowsHandler,
  getWorkflowRunsHandler,
  getWorkflowRunDetailsHandler,
  updateWorkflowHandler,
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
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", default: 1, minimum: 1 },
            limit: { type: "number", default: 10, minimum: 1, maximum: 100 },
            search: { type: "string" },
          },
        },
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

  app.patch(
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
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            triggerType: { type: "string" },
            isActive: { type: "boolean" },
            actionType: { type: "string" },
            config: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    updateWorkflowHandler,
  );

  app.get(
    "/:id/runs",
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
    getWorkflowRunsHandler,
  );

  app.get(
    "/:id/runs/:runId",
    {
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            runId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    getWorkflowRunDetailsHandler,
  );
}
