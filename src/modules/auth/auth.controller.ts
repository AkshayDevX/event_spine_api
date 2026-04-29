import { FastifyReply, FastifyRequest } from "fastify";
import "@fastify/jwt";
import { authService } from "./auth.service";
import {
  createApiKeySchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  signupSchema,
} from "./auth.schema";
import { credentialService } from "./credential.service";
import { env } from "../../config/env";

interface JwtPayload {
  id: string;
  email: string;
  workspaceId: string;
  sessionId?: string;
  role?: string;
  scopes?: string[];
  authType?: "jwt" | "api_key";
}

function getSessionMetadata(request: FastifyRequest) {
  const userAgent = request.headers["user-agent"];
  return {
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    ipAddress: request.ip,
  };
}

async function signAccessToken(
  reply: FastifyReply,
  payload: JwtPayload,
) {
  return await reply.jwtSign(payload, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export async function signupHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = signupSchema.parse(request.body);
    const result = await authService.signup(data);

    const workspaceAccess = {
      role: "owner",
      scopes: ["workflow:read", "workflow:write", "workflow:execute", "api_keys:manage"],
    };
    const refreshSession = await authService.createSession(
      result.user.id,
      result.workspace.id,
      getSessionMetadata(request),
    );
    const token = await signAccessToken(reply, {
      id: result.user.id,
      email: result.user.email,
      workspaceId: result.workspace.id,
      sessionId: refreshSession.storedToken.id,
      ...workspaceAccess,
    });

    return reply.status(201).send({
      token,
      accessToken: token,
      refreshToken: refreshSession.token,
      user: {
        id: result.user.id,
        email: result.user.email,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
      },
      ...workspaceAccess,
    });
  } catch (err: unknown) {
    request.log.error(err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return reply.status(400).send({ message });
  }
}

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = loginSchema.parse(request.body);
    const user = await authService.login(data);
    const workspaceAccess = await authService.getPrimaryWorkspaceForUser(user.id);
    const refreshSession = await authService.createSession(
      user.id,
      workspaceAccess.workspaceId,
      getSessionMetadata(request),
    );
    const token = await signAccessToken(reply, {
      id: user.id,
      email: user.email,
      workspaceId: workspaceAccess.workspaceId,
      sessionId: refreshSession.storedToken.id,
      role: workspaceAccess.role,
      scopes: workspaceAccess.scopes,
    });

    return reply.send({
      token,
      accessToken: token,
      refreshToken: refreshSession.token,
      workspace: workspaceAccess.workspace,
      role: workspaceAccess.role,
      scopes: workspaceAccess.scopes,
    });
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Invalid credentials";
    return reply.status(401).send({ message });
  }
}

export async function refreshTokenHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = refreshTokenSchema.parse(request.body);
    const rotated = await credentialService.rotateRefreshToken(
      data.refreshToken,
      getSessionMetadata(request),
    );
    if (!rotated.user || !rotated.workspace) {
      throw new Error("Invalid refresh token");
    }

    const workspaceAccess = await authService.getPrimaryWorkspaceForUser(
      rotated.user.id,
    );

    const token = await signAccessToken(reply, {
      id: rotated.user.id,
      email: rotated.user.email,
      workspaceId: rotated.workspace.id,
      sessionId: rotated.storedToken.id,
      role: workspaceAccess.role,
      scopes: workspaceAccess.scopes,
    });

    return reply.send({
      token,
      accessToken: token,
      refreshToken: rotated.token,
      workspace: rotated.workspace,
      role: workspaceAccess.role,
      scopes: workspaceAccess.scopes,
    });
  } catch (err: unknown) {
    request.log.error(err);
    return reply.status(401).send({ message: "Invalid refresh token" });
  }
}

export async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const data = logoutSchema.parse(request.body);
  await credentialService.revokeRefreshToken(data.refreshToken);
  return reply.status(204).send();
}

export async function listSessionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: userId, sessionId } = request.user as JwtPayload;
  const sessions = await credentialService.listActiveSessions(userId);

  return reply.send({
    sessions: sessions.map((session) => ({
      ...session,
      current: session.id === sessionId,
    })),
  });
}

export async function revokeSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { id: userId } = request.user as JwtPayload;
    const { id: sessionId } = request.params as { id: string };
    await credentialService.revokeSession(userId, sessionId);
    return reply.status(204).send();
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Not found";
    return reply.status(404).send({ message });
  }
}

export async function revokeOtherSessionsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id: userId, sessionId } = request.user as JwtPayload;
  if (!sessionId) {
    return reply.status(400).send({ message: "Current session is required" });
  }

  await credentialService.revokeOtherSessions(userId, sessionId);
  return reply.status(204).send();
}

export async function createApiKeyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = createApiKeySchema.parse(request.body);
    const { id: principalId, workspaceId, authType } = request.user as JwtPayload;
    const result = await credentialService.createApiKey(
      workspaceId,
      authType === "api_key" ? undefined : principalId,
      data,
    );

    return reply.status(201).send({
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        keyPrefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt,
      },
      key: result.key,
    });
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    return reply.status(400).send({ message });
  }
}

export async function listApiKeysHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { workspaceId } = request.user as JwtPayload;
  const keys = await credentialService.listApiKeys(workspaceId);
  return reply.send({ apiKeys: keys });
}

export async function revokeApiKeyHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    await credentialService.revokeApiKey(workspaceId, id);
    return reply.status(204).send();
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Not found";
    return reply.status(404).send({ message });
  }
}
