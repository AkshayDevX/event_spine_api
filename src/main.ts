import { buildApp } from "./app";
import { env } from "./config/env";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: Number(env.PORT),
      host: "0.0.0.0",
    });

    app.log.info(`Server running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    app.log.info("Shutting down gracefully...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
