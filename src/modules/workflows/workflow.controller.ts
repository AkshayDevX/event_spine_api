import { FastifyReply, FastifyRequest } from "fastify";
import { workflowService } from "./workflow.service";
import { createWorkflowSchema } from "./workflow.schema";

export async function createWorkflowHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as any;

    const data = createWorkflowSchema.parse(request.body);

    const result = await workflowService.createWorkflow(workspaceId, data);

    return reply.status(201).send(result);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(400).send({ message: err.message });
  }
}

export async function listWorkflowsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as any;
    const workflows = await workflowService.listWorkflows(workspaceId);
    return reply.send({ workflows });
  } catch (err: any) {
    request.log.error(err);
    return reply.status(500).send({ message: "Internal Server Error" });
  }
}

export async function getWorkflowHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { workspaceId } = request.user as any;
    const workflowId = request.params.id;

    const workflow = await workflowService.getWorkflow(workspaceId, workflowId);
    return reply.send(workflow);
  } catch (err: any) {
    request.log.error(err);
    return reply.status(404).send({ message: err.message });
  }
}
