import { z } from "zod";

export const createWorkflowSchema = z.object({
  name: z.string().min(1),
  triggerType: z.string().default("webhook"),
  actionType: z.string(),
  config: z.record(z.string(), z.any()),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
