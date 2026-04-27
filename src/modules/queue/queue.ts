import { Queue, type QueueOptions } from "bullmq";
import Redis from "ioredis";
import { env } from "../../config/env";

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const defaultJobOptions: QueueOptions["defaultJobOptions"] = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

export const QUEUE_NAME = "webhooks";

export type WebhookJobData = {
  runId: string;
};

export const webhookQueue = new Queue<WebhookJobData, void, string>(
  QUEUE_NAME,
  {
    connection,
    defaultJobOptions,
  },
);
