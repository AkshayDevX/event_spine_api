import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      workspaceId: string;
      sessionId?: string;
      role?: string;
      scopes?: string[];
      authType?: "jwt" | "api_key";
    };
    user: {
      id: string;
      email: string;
      workspaceId: string;
      sessionId?: string;
      role?: string;
      scopes?: string[];
      authType?: "jwt" | "api_key";
    };
  }
}
