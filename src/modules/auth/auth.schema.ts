import { z } from "zod";
import { permissionScopes } from "./permissions";

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  fullName: z.string(),
  workspaceName: z.string(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32),
});

export const logoutSchema = refreshTokenSchema;

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(permissionScopes)).min(1),
  expiresAt: z.iso.datetime().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
