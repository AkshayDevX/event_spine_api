import { z } from "zod";

export const createWorkflowSchema = z.object({
  name: z.string().min(1),
  triggerType: z.string().default("webhook"),
  actionType: z.enum(["http_request", "filter"]),
  config: z.record(z.string(), z.any()),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

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
