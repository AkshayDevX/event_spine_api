import { FastifyReply, FastifyRequest } from "fastify";
import { workflowService } from "./workflow.service";
import { createWorkflowSchema } from "./workflow.schema";

interface JwtPayload {
  id: string;
  email: string;
  workspaceId: string;
}

export async function createWorkflowHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;

    const data = createWorkflowSchema.parse(request.body);

    const result = await workflowService.createWorkflow(workspaceId, data);

    return reply.status(201).send(result);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    return reply.status(400).send({ message });
  }
}

export async function listWorkflowsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const workflows = await workflowService.listWorkflows(workspaceId);
    return reply.send({ workflows });
  } catch (err: unknown) {
    request.log.error(err);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

export async function getWorkflowHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const workflowId = request.params.id;

    const workflow = await workflowService.getWorkflow(workspaceId, workflowId);
    return reply.send(workflow);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Not found";
    return reply.status(404).send({ message });
  }
}

export async function getWorkflowRunsHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const workflowId = request.params.id;

    const runs = await workflowService.getWorkflowRuns(workspaceId, workflowId);
    return reply.send({ runs });
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Not found";
    return reply.status(404).send({ message });
  }
}

export async function getWorkflowRunDetailsHandler(
  request: FastifyRequest<{ Params: { id: string; runId: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const { id: workflowId, runId } = request.params;

    const runDetails = await workflowService.getWorkflowRunDetails(
      workspaceId,
      workflowId,
      runId,
    );
    return reply.send(runDetails);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Not found";
    return reply.status(404).send({ message });
  }
}
