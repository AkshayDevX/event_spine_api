import Redis from "ioredis";
import { env } from "../../config/env";

export const pubClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const subClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Event Payloads Definition
export type LiveEventPayload =
  | { type: "workflow.started"; runId: string }
  | { type: "workflow.completed"; runId: string }
  | { type: "workflow.failed"; runId: string; error: string }
  | { type: "workflow.halted"; runId: string }
  | {
      type: "step.running";
      runId: string;
      stepId: string;
      orderNumber: number;
    }
  | {
      type: "step.completed";
      runId: string;
      stepId: string;
      orderNumber: number;
    }
  | {
      type: "step.failed";
      runId: string;
      stepId: string;
      orderNumber: number;
      error: string;
    };

export function getWorkflowChannel(workflowId: string): string {
  return `workflow:${workflowId}:live`;
}

export async function publishLiveEvent(
  workflowId: string,
  event: LiveEventPayload,
) {
  const channel = getWorkflowChannel(workflowId);
  const allChannel = getWorkflowChannel("all");
  await pubClient.publish(channel, JSON.stringify(event));
  await pubClient.publish(allChannel, JSON.stringify(event));
}
