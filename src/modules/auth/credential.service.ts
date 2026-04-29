import crypto from "crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "../../../drizzle";
import { apiKeys, refreshTokens } from "../../../drizzle/schema/tenant";
import { env } from "../../config/env";
import { CreateApiKeyInput } from "./auth.schema";
import { PermissionScope } from "./permissions";

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export function hashSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class CredentialService {
  generateRefreshToken() {
    return `esp_rt_${crypto.randomBytes(48).toString("base64url")}`;
  }

  async createRefreshToken(
    userId: string,
    workspaceId: string,
    metadata: SessionMetadata = {},
  ) {
    const token = this.generateRefreshToken();
    const now = new Date();
    const [storedToken] = await db
      .insert(refreshTokens)
      .values({
        userId,
        workspaceId,
        tokenHash: hashSecret(token),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        lastUsedAt: now,
        expiresAt: addDays(now, env.REFRESH_TOKEN_TTL_DAYS),
      })
      .returning();

    return { token, storedToken };
  }

  async rotateRefreshToken(token: string, metadata: SessionMetadata = {}) {
    const tokenHash = hashSecret(token);
    const existingToken = await db.query.refreshTokens.findFirst({
      where: { tokenHash },
      with: {
        user: true,
        workspace: true,
      },
    });

    if (
      !existingToken ||
      existingToken.revokedAt ||
      existingToken.expiresAt <= new Date()
    ) {
      throw new Error("Invalid refresh token");
    }

    const nextToken = this.generateRefreshToken();
    const now = new Date();

    return await db.transaction(async (tx) => {
      const [newToken] = await tx
        .insert(refreshTokens)
        .values({
          userId: existingToken.userId,
          workspaceId: existingToken.workspaceId,
          tokenHash: hashSecret(nextToken),
          userAgent: metadata.userAgent ?? existingToken.userAgent,
          ipAddress: metadata.ipAddress ?? existingToken.ipAddress,
          lastUsedAt: now,
          expiresAt: addDays(now, env.REFRESH_TOKEN_TTL_DAYS),
        })
        .returning();

      await tx
        .update(refreshTokens)
        .set({
          revokedAt: now,
          lastUsedAt: now,
          replacedByTokenId: newToken.id,
        })
        .where(eq(refreshTokens.id, existingToken.id));

      return {
        token: nextToken,
        storedToken: newToken,
        user: existingToken.user,
        workspace: existingToken.workspace,
      };
    });
  }

  async revokeRefreshToken(token: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashSecret(token)));
  }

  async listActiveSessions(userId: string) {
    return await db
      .select({
        id: refreshTokens.id,
        workspaceId: refreshTokens.workspaceId,
        userAgent: refreshTokens.userAgent,
        ipAddress: refreshTokens.ipAddress,
        lastUsedAt: refreshTokens.lastUsedAt,
        expiresAt: refreshTokens.expiresAt,
        createdAt: refreshTokens.createdAt,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );
  }

  async revokeSession(userId: string, sessionId: string) {
    const [session] = await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(refreshTokens.userId, userId), eq(refreshTokens.id, sessionId)),
      )
      .returning();

    if (!session) {
      throw new Error("Session not found");
    }
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          ne(refreshTokens.id, currentSessionId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }

  async createApiKey(
    workspaceId: string,
    createdByUserId: string | undefined,
    input: CreateApiKeyInput,
  ) {
    const prefix = crypto.randomBytes(4).toString("hex");
    const secret = crypto.randomBytes(32).toString("base64url");
    const rawKey = `esp_live_${prefix}_${secret}`;

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        workspaceId,
        createdByUserId,
        name: input.name,
        keyPrefix: prefix,
        keyHash: hashSecret(rawKey),
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      })
      .returning();

    return { apiKey, key: rawKey };
  }

  async listApiKeys(workspaceId: string) {
    return await db.query.apiKeys.findMany({
      where: { workspaceId },
      columns: {
        keyHash: false,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeApiKey(workspaceId: string, apiKeyId: string) {
    const [apiKey] = await db
      .update(apiKeys)
      .set({ isActive: false, revokedAt: new Date() })
      .where(
        and(eq(apiKeys.id, apiKeyId), eq(apiKeys.workspaceId, workspaceId)),
      )
      .returning();

    if (!apiKey) {
      throw new Error("API key not found");
    }
  }

  async verifyApiKey(rawKey: string) {
    const apiKey = await db.query.apiKeys.findFirst({
      where: { keyHash: hashSecret(rawKey) },
    });

    if (
      !apiKey ||
      !apiKey.isActive ||
      apiKey.revokedAt ||
      (apiKey.expiresAt && apiKey.expiresAt <= new Date())
    ) {
      throw new Error("Invalid API key");
    }

    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));

    return {
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
      scopes: apiKey.scopes as PermissionScope[],
    };
  }
}

export const credentialService = new CredentialService();
