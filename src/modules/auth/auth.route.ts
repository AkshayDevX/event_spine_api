import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createApiKeyHandler,
  listApiKeysHandler,
  listSessionsHandler,
  loginHandler,
  logoutHandler,
  refreshTokenHandler,
  revokeApiKeyHandler,
  revokeOtherSessionsHandler,
  revokeSessionHandler,
  signupHandler,
} from "./auth.controller";
import { requireWorkspaceAuth } from "./workspace-auth";

async function requireBearerSession(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ message: "Unauthorized" });
  }
}

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/signup",
    {
      schema: {
        description: "Sign up a new user and create a workspace",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password", "fullName", "workspaceName"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
            fullName: { type: "string" },
            workspaceName: { type: "string" },
          },
        },
      },
    },
    signupHandler,
  );

  app.post(
    "/login",
    {
      schema: {
        description: "Login and get a JWT token",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    loginHandler,
  );

  app.post(
    "/refresh",
    {
      schema: {
        description: "Rotate a refresh token and issue a new access token",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },
      },
    },
    refreshTokenHandler,
  );

  app.post(
    "/logout",
    {
      schema: {
        description: "Revoke a refresh token",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },
      },
    },
    logoutHandler,
  );

  app.get(
    "/sessions",
    {
      preHandler: requireBearerSession,
      schema: {
        description: "List active refresh-token sessions for the current user",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
      },
    },
    listSessionsHandler,
  );

  app.delete(
    "/sessions/others",
    {
      preHandler: requireBearerSession,
      schema: {
        description: "Revoke all active sessions except the current one",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
      },
    },
    revokeOtherSessionsHandler,
  );

  app.delete(
    "/sessions/:id",
    {
      preHandler: requireBearerSession,
      schema: {
        description: "Revoke one active session for the current user",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    revokeSessionHandler,
  );

  app.post(
    "/api-keys",
    {
      preHandler: requireWorkspaceAuth(["api_keys:manage"]),
      schema: {
        description: "Create a workspace API key. The raw key is shown once.",
        tags: ["api-keys"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        body: {
          type: "object",
          required: ["name", "scopes"],
          properties: {
            name: { type: "string" },
            scopes: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    createApiKeyHandler,
  );

  app.get(
    "/api-keys",
    {
      preHandler: requireWorkspaceAuth(["api_keys:manage"]),
      schema: {
        description: "List workspace API keys without secret hashes",
        tags: ["api-keys"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      },
    },
    listApiKeysHandler,
  );

  app.delete(
    "/api-keys/:id",
    {
      preHandler: requireWorkspaceAuth(["api_keys:manage"]),
      schema: {
        description: "Revoke a workspace API key",
        tags: ["api-keys"],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    revokeApiKeyHandler,
  );
}
