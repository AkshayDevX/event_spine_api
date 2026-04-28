import { FastifyReply, FastifyRequest } from "fastify";
import { workflowService } from "./workflow.service";
import { createWorkflowSchema, updateWorkflowSchema, addStepSchema, updateStepSchema } from "./workflow.schema";

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
  request: FastifyRequest<{
    Querystring: { page: number; limit: number; search?: string };
  }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const { page, limit, search } = request.query;
    const result = await workflowService.listWorkflows(workspaceId, {
      page,
      limit,
      search,
    });
    return reply.send(result);
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
    return reply.send({ workflow });
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Not found";
    return reply.status(404).send({ message });
  }
}

export async function updateWorkflowHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const workflowId = request.params.id;

    const data = updateWorkflowSchema.parse(request.body);

    const result = await workflowService.updateWorkflow(
      workspaceId,
      workflowId,
      data,
    );

    return reply.send(result);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";

    if (message === "Workflow not found") {
      return reply.status(404).send({ message });
    }

    return reply.status(400).send({ message });
  }
}

export async function getWorkflowRunsHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const workflowId = request.params.id;
    const page = parseInt(request.query.page || "1", 10);
    const limit = parseInt(request.query.limit || "10", 10);

    const result = await workflowService.getWorkflowRuns(workspaceId, workflowId, {
      page,
      limit,
    });
    return reply.send(result);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Not found";
    return reply.status(404).send({ message });
  }
}

export async function getAllWorkspaceRunsHandler(
  request: FastifyRequest<{
    Querystring: { workflowId?: string; page?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const page = parseInt(request.query.page || "1", 10);
    const limit = parseInt(request.query.limit || "10", 10);
    const workflowId = request.query.workflowId;

    const result = await workflowService.getAllWorkspaceRuns(workspaceId, {
      workflowId,
      page,
      limit,
    });
    return reply.send(result);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    return reply.status(400).send({ message });
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

export async function addStepHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const workflowId = request.params.id;

    const data = addStepSchema.parse(request.body);

    const step = await workflowService.addStep(workspaceId, workflowId, data);

    return reply.status(201).send(step);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    return reply.status(400).send({ message });
  }
}

export async function updateStepHandler(
  request: FastifyRequest<{ Params: { id: string; stepId: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const { id: workflowId, stepId } = request.params;

    const data = updateStepSchema.parse(request.body);

    const step = await workflowService.updateStep(workspaceId, workflowId, stepId, data);

    return reply.send(step);
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    if (message === "Workflow not found" || message === "Step not found") {
      return reply.status(404).send({ message });
    }
    return reply.status(400).send({ message });
  }
}

export async function deleteStepHandler(
  request: FastifyRequest<{ Params: { id: string; stepId: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as JwtPayload;
    const { id: workflowId, stepId } = request.params;

    await workflowService.deleteStep(workspaceId, workflowId, stepId);

    return reply.status(204).send();
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : "Bad request";
    if (message === "Workflow not found" || message === "Step not found") {
      return reply.status(404).send({ message });
    }
    return reply.status(400).send({ message });
  }
}
