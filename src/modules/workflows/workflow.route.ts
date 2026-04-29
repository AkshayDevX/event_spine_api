import { FastifyInstance } from "fastify";
import {
  createWorkflowHandler,
  getWorkflowHandler,
  listWorkflowsHandler,
  getWorkflowRunsHandler,
  getWorkflowRunDetailsHandler,
  updateWorkflowHandler,
  addStepHandler,
  updateStepHandler,
  deleteStepHandler,
  getAllWorkspaceRunsHandler,
} from "./workflow.controller";
import { requireWorkspaceAuth } from "../auth/workspace-auth";
import { PermissionScope } from "../auth/permissions";

export default async function workflowRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const requiredScopes =
      (request.routeOptions.config.requiredScopes as PermissionScope[]) ?? [];
    await requireWorkspaceAuth(requiredScopes)(request, reply);
  });

  app.post(
    "/",
    {
      config: { requiredScopes: ["workflow:write"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        body: {
          type: "object",
          required: ["name", "steps"],
          properties: {
            name: { type: "string" },
            triggerType: { type: "string", default: "webhook" },
            steps: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["actionType", "config"],
                properties: {
                  actionType: { type: "string" },
                  config: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    createWorkflowHandler,
  );

  app.get(
    "/",
    {
      config: { requiredScopes: ["workflow:read"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
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
      config: { requiredScopes: ["workflow:read"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
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
      config: { requiredScopes: ["workflow:write"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
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
          },
        },
      },
    },
    updateWorkflowHandler,
  );

  app.get(
    "/runs/all",
    {
      config: { requiredScopes: ["workflow:read"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            workflowId: { type: "string" },
            page: { type: "string" },
            limit: { type: "string" },
          },
        },
      },
    },
    getAllWorkspaceRunsHandler,
  );

  app.get(
    "/:id/runs",
    {
      config: { requiredScopes: ["workflow:read"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "string" },
            limit: { type: "string" },
          },
        },
      },
    },
    getWorkflowRunsHandler,
  );

  app.get(
    "/:id/runs/:runId",
    {
      config: { requiredScopes: ["workflow:read"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
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

  app.post(
    "/:id/steps",
    {
      config: { requiredScopes: ["workflow:write"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["actionType", "config"],
          properties: {
            actionType: { type: "string" },
            orderNumber: { type: "string" },
            config: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    addStepHandler,
  );

  app.patch(
    "/:id/steps/:stepId",
    {
      config: { requiredScopes: ["workflow:write"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            stepId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            actionType: { type: "string" },
            orderNumber: { type: "string" },
            config: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    updateStepHandler,
  );

  app.delete(
    "/:id/steps/:stepId",
    {
      config: { requiredScopes: ["workflow:write"] },
      schema: {
        tags: ["workflows"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            stepId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    deleteStepHandler,
  );
}
