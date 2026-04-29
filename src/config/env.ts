import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const pm2InstancesSchema = z.union([
  z.literal("max"),
  z.coerce.number().int().positive(),
]);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(7000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string(),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  PM2_INSTANCES: pm2InstancesSchema.default("max"),
  PM2_WORKER_INSTANCES: z.coerce.number().int().positive().default(1),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  WEBHOOK_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  HTTP_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  HTTP_CIRCUIT_RESET_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("debug"),
});

export const env = envSchema.parse(process.env);
