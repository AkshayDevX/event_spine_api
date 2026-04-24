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
        },
      },
    },
  });

  const swaggerUi = await import("@fastify/swagger-ui");
  await app.register(swaggerUi.default, {
    routePrefix: "/docs",
  });
}
