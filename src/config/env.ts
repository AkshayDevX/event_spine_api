import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(7000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string(),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("debug"),
});

export const env = envSchema.parse(process.env);
