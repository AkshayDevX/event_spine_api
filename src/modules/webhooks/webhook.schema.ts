import { z } from "zod";

export const webhookPayloadSchema = z.record(z.string(), z.any());
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export interface WorkflowWithSteps {
  id: string;
  name: string;
  isActive: boolean;
  steps: {
    id: string;
    actionType: string;
    orderNumber: string;
    config: unknown;
  }[];
}
