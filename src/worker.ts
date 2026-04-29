import Fastify from "fastify";
import fastifyMetrics from "fastify-metrics";
import { Gauge } from "prom-client";
import { webhookWorker } from "./modules/queue/worker.service";
import { webhookQueue } from "./modules/queue/queue";
import { env } from "./config/env";

// Custom metrics for BullMQ
const queueWaitingGauge = new Gauge({
  name: "eventspine_worker_queue_waiting",
  help: "Number of jobs waiting in the queue",
  labelNames: ["queue"]
});

const queueActiveGauge = new Gauge({
  name: "eventspine_worker_queue_active",
  help: "Number of jobs currently being processed",
  labelNames: ["queue"]
});

const queueFailedGauge = new Gauge({
  name: "eventspine_worker_queue_failed",
  help: "Number of failed jobs in the queue",
  labelNames: ["queue"]
});

async function startWorker() {
  console.log(`[Worker] Starting in ${env.NODE_ENV} mode...`);
  console.log(`[Worker] Connecting to Redis at ${env.REDIS_URL}...`);

  // Create a minimal Fastify server for health and metrics
  const app = Fastify({ logger: false });
  
  await app.register(fastifyMetrics, {
    endpoint: "/metrics",
    defaultMetrics: { enabled: true }
  });

  app.get("/health", async () => ({ status: "ok" }));

  // Periodically update BullMQ metrics using the queue instance
  setInterval(async () => {
    try {
      const counts = await webhookQueue.getJobCounts("waiting", "active", "failed");
      queueWaitingGauge.set({ queue: "webhooks" }, counts.waiting);
      queueActiveGauge.set({ queue: "webhooks" }, counts.active);
      queueFailedGauge.set({ queue: "webhooks" }, counts.failed);
    } catch (err) {
      console.error("[Worker] Error updating metrics:", err);
    }
  }, 5000);

  webhookWorker.on("ready", () => {
    console.log(`[Worker] Ready and listening for jobs on queue 'webhooks'`);
  });

  const shutdown = async () => {
    console.log("[Worker] Shutting down gracefully...");
    await webhookWorker.close();
    await app.close();
    console.log("[Worker] Closed connections. Exiting.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start metrics server
  const port = 3000;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`[Worker] Metrics server listening on port ${port}`);
}

startWorker().catch((err) => {
  console.error("[Worker] Fatal error starting worker:", err);
  process.exit(1);
});
