import { FastifyReply, FastifyRequest } from "fastify";
import "@fastify/jwt";
import { authService } from "./auth.service";
import { loginSchema, signupSchema } from "./auth.schema";
import { db } from "../../../drizzle";

export async function signupHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = signupSchema.parse(request.body);
    const result = await authService.signup(data);

    // Provide the token
    const token = await reply.jwtSign({
      id: result.user.id,
      email: result.user.email,
      workspaceId: result.workspace.id,
    });

    return reply.status(201).send({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
      },
    });
  } catch (err: unknown) {
    request.log.error(err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return reply.status(400).send({ message });
  }
}

export async function loginHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const data = loginSchema.parse(request.body);
    const user = await authService.login(data);

    const memberRecord = await db.query.workspaceMembers.findFirst({
      where: {
        userId: user.id,
      },
      with: {
        workspace: true,
      },
    });

    if (!memberRecord) {
      throw new Error("No workspace associated with user");
    }

    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
      workspaceId: memberRecord.workspaceId,
    });

    return reply.send({ token });
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Invalid credentials";
    return reply.status(401).send({ message });
  }
}
