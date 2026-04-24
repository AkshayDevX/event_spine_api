import { FastifyInstance } from "fastify";
import { loginHandler, signupHandler } from "./auth.controller";

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/signup",
    {
      schema: {
        description: "Sign up a new user and create a workspace",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password", "workspaceName"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
            fullName: { type: "string" },
            workspaceName: { type: "string" },
          },
        },
      },
    },
    signupHandler,
  );

  app.post(
    "/login",
    {
      schema: {
        description: "Login and get a JWT token",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    loginHandler,
  );
}
