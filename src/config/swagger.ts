import { FastifyInstance } from "fastify";

export async function registerSwagger(app: FastifyInstance) {
  const swagger = await import("@fastify/swagger");
  await app.register(swagger.default, {
    openapi: {
      info: {
        title: "EventSpine API",
        description: "Webhook automation platform",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          apiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
            description: "Workspace API key with the required route scope.",
          },
        },
      },
    },
  });

  const swaggerUi = await import("@fastify/swagger-ui");
  await app.register(swaggerUi.default, {
    routePrefix: "/docs",
  });
}
