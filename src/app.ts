import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyWebsocket from "@fastify/websocket";
import { loggerOptions } from "./config/logger";
import { registerSwagger } from "./config/swagger";
import { env } from "./config/env";
import healthRoutes from "./modules/health/health.route";
import authRoutes from "./modules/auth/auth.route";
import workflowRoutes from "./modules/workflows/workflow.route";
import webhookRoutes from "./modules/webhooks/webhook.route";
import liveRoutes from "./modules/live/live.route";

export async function buildApp() {
  const app = Fastify({
    logger: loggerOptions,
  });

  // Register CORS
  app.register(fastifyCors, {
    origin: "http://localhost:3000",
    credentials: true,
  });

  // Register JWT
  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  // Register Swagger
  await registerSwagger(app);

  // Register WebSockets
  await app.register(fastifyWebsocket);

  // Register Routes
  await app.register(healthRoutes, { prefix: "/api/v1/health" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(workflowRoutes, { prefix: "/api/v1/workflows" });
  await app.register(webhookRoutes, { prefix: "/api/v1/hooks" });
  await app.register(liveRoutes, { prefix: "/api/v1/live" });

  return app;
}
