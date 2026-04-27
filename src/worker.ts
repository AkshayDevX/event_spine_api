import { webhookWorker } from "./modules/queue/worker.service";
import { env } from "./config/env";

async function startWorker() {
  console.log(`[Worker] Starting in ${env.NODE_ENV} mode...`);
  console.log(`[Worker] Connecting to Redis at ${env.REDIS_URL}...`);

  webhookWorker.on("ready", () => {
    console.log(`[Worker] Ready and listening for jobs on queue 'webhooks'`);
  });

  const shutdown = async () => {
    console.log("[Worker] Shutting down gracefully...");
    await webhookWorker.close();
    console.log("[Worker] Closed connections. Exiting.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker().catch((err) => {
  console.error("[Worker] Fatal error starting worker:", err);
  process.exit(1);
});
