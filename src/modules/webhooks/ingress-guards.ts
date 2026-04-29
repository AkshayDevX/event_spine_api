import Redis from "ioredis";
import { env } from "../../config/env";

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

export class DuplicateWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateWebhookError";
  }
}

export async function enforceWebhookRateLimit(args: {
  workspaceId: string;
  webhookPath: string;
}) {
  const key = `rate:webhook:${args.workspaceId}:${args.webhookPath}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, env.WEBHOOK_RATE_LIMIT_WINDOW_SECONDS);
  }

  if (count > env.WEBHOOK_RATE_LIMIT_MAX) {
    const ttl = await redis.ttl(key);
    throw new RateLimitExceededError(
      "Webhook rate limit exceeded for this workspace",
      ttl > 0 ? ttl : env.WEBHOOK_RATE_LIMIT_WINDOW_SECONDS,
    );
  }

  return {
    limit: env.WEBHOOK_RATE_LIMIT_MAX,
    remaining: Math.max(env.WEBHOOK_RATE_LIMIT_MAX - count, 0),
  };
}

export async function reserveIdempotencyKey(args: {
  workspaceId: string;
  webhookPath: string;
  idempotencyKey: string;
}) {
  const key = `idempotency:webhook:${args.workspaceId}:${args.webhookPath}:${args.idempotencyKey}`;
  const reserved = await redis.set(
    key,
    "reserved",
    "EX",
    env.IDEMPOTENCY_TTL_SECONDS,
    "NX",
  );

  if (reserved !== "OK") {
    throw new DuplicateWebhookError("Duplicate webhook delivery ignored");
  }
}
