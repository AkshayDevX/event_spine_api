import { z } from "zod";

export const stepSchema = z.object({
  actionType: z.enum(["http_request", "filter"]),
  config: z.record(z.string(), z.any()),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1),
  triggerType: z.string().default("webhook"),
  steps: z.array(stepSchema).min(1),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  triggerType: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

export const addStepSchema = z.object({
  actionType: z.enum(["http_request", "filter"]),
  orderNumber: z.string().optional(),
  config: z.record(z.string(), z.any()),
});

export type AddStepInput = z.infer<typeof addStepSchema>;

export const updateStepSchema = z.object({
  actionType: z.enum(["http_request", "filter"]).optional(),
  orderNumber: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
});

export type UpdateStepInput = z.infer<typeof updateStepSchema>;

export interface HttpRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}

export interface FilterConfig {
  key: string;
  operator: "equals" | "not_equals" | "contains" | "exists";
  value?: unknown;
}

export type StepConfig = HttpRequestConfig | FilterConfig;
export type Payload = Record<string, unknown>;
