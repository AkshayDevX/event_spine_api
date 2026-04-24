import { db } from "../../../drizzle";
import { workflows, workflowSteps } from "../../../drizzle/schema/workflow";
import { CreateWorkflowInput } from "./workflow.schema";
import crypto from "crypto";

export class WorkflowService {
  async createWorkflow(workspaceId: string, data: CreateWorkflowInput) {
    const webhookPath = crypto.randomBytes(16).toString("hex");

    return await db.transaction(async (tx) => {
      const [workflow] = await tx
        .insert(workflows)
        .values({
          workspaceId,
          name: data.name,
          triggerType: data.triggerType,
          webhookPath,
        })
        .returning();

      const [step] = await tx
        .insert(workflowSteps)
        .values({
          workflowId: workflow.id,
          actionType: data.actionType,
          config: data.config,
        })
        .returning();

      return { workflow, step };
    });
  }

  async listWorkflows(workspaceId: string) {
    return await db.query.workflows.findMany({
      where: {
        workspaceId,
      },
      with: {
        steps: true,
      },
    });
  }

  async getWorkflow(workspaceId: string, workflowId: string) {
    const workflow = await db.query.workflows.findFirst({
      where: {
        workspaceId,
        id: workflowId,
      },
      with: {
        steps: true,
      },
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    return workflow;
  }
}

export const workflowService = new WorkflowService();
