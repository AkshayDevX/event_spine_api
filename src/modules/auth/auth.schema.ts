import { z } from "zod";

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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
