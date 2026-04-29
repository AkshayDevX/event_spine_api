import "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    requiredScopes?: string[];
  }
}
