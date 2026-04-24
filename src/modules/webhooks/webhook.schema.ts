import { z } from "zod";

export const webhookPayloadSchema = z.record(z.string(), z.any());
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
