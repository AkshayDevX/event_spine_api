import { FastifyReply, FastifyRequest } from "fastify";
import { credentialService } from "./credential.service";
import {
  hasRequiredScopes,
  PermissionScope,
  scopesForRole,
  WorkspaceRole,
} from "./permissions";

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader?.startsWith("Bearer ")) return undefined;
  return authorizationHeader.slice("Bearer ".length);
}

function getApiKey(request: FastifyRequest) {
  const header = request.headers["x-api-key"];
  if (Array.isArray(header)) return header[0];
  return header;
}

export function requireWorkspaceAuth(requiredScopes: PermissionScope[] = []) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = getApiKey(request);

    try {
      if (apiKey) {
        const credential = await credentialService.verifyApiKey(apiKey);
        if (!hasRequiredScopes(credential.scopes, requiredScopes)) {
          return reply.status(403).send({ message: "Insufficient scope" });
        }

        request.user = {
          id: credential.id,
          email: "api-key",
          workspaceId: credential.workspaceId,
          role: "api_key",
          scopes: credential.scopes,
          authType: "api_key",
        };
        return;
      }

      await request.jwtVerify();
      const role = (request.user.role ?? "owner") as WorkspaceRole;
      const scopes = request.user.scopes ?? scopesForRole(role);

      if (!hasRequiredScopes(scopes, requiredScopes)) {
        return reply.status(403).send({ message: "Insufficient scope" });
      }

      request.user = {
        ...request.user,
        role,
        scopes,
        authType: "jwt",
      };
    } catch {
      return reply.status(401).send({ message: "Unauthorized" });
    }
  };
}

export function extractAccessToken(authorizationHeader: string | undefined) {
  return getBearerToken(authorizationHeader);
}
