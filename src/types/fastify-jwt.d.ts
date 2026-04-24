import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email: string; workspaceId: string };
    user: {
      id: string;
      email: string;
      workspaceId: string;
    };
  }
}
