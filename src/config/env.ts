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
});

export const env = envSchema.parse(process.env);
