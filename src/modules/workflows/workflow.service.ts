import { db } from "../../../drizzle";
import { workflows, workflowSteps } from "../../../drizzle/schema/workflow";
import { CreateWorkflowInput, UpdateWorkflowInput } from "./workflow.schema";
import crypto from "crypto";
import { count, and, ilike, eq } from "drizzle-orm";

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

  async updateWorkflow(workspaceId: string, workflowId: string, data: UpdateWorkflowInput) {
    return await db.transaction(async (tx) => {
      // Update workflow basic details if provided
      if (data.name !== undefined || data.triggerType !== undefined || data.isActive !== undefined) {
        const [wf] = await tx
          .update(workflows)
          .set({
            ...(data.name !== undefined && { name: data.name }),
            ...(data.triggerType !== undefined && { triggerType: data.triggerType }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
            updatedAt: new Date(),
          })
          .where(and(eq(workflows.id, workflowId), eq(workflows.workspaceId, workspaceId)))
          .returning();
          
        if (!wf) throw new Error("Workflow not found");
      } else {
        const wf = await tx.query.workflows.findFirst({
          where: { id: workflowId, workspaceId }
        });
        if (!wf) throw new Error("Workflow not found");
      }

      // Update the first step if action details provided
      if (data.actionType !== undefined || data.config !== undefined) {
        const step = await tx.query.workflowSteps.findFirst({
          where: { workflowId }
        });
        
        if (step) {
          await tx
            .update(workflowSteps)
            .set({
              ...(data.actionType !== undefined && { actionType: data.actionType }),
              ...(data.config !== undefined && { config: data.config }),
              updatedAt: new Date(),
            })
            .where(eq(workflowSteps.id, step.id));
        }
      }

      return await tx.query.workflows.findFirst({
        where: { id: workflowId },
        with: {
          steps: true,
        },
      });
    });
  }

  async listWorkflows(workspaceId: string, options: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = options;
    const offset = (page - 1) * limit;

    const data = await db.query.workflows.findMany({
      where: {
        workspaceId,
        ...(search ? { name: { ilike: `%${search}%` } } : {}),
      },
      with: {
        steps: true,
      },
      limit,
      offset,
    });

    const whereClause = search
      ? and(eq(workflows.workspaceId, workspaceId), ilike(workflows.name, `%${search}%`))
      : eq(workflows.workspaceId, workspaceId);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(workflows)
      .where(whereClause);

    return {
      workflows: data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  async getWorkflowRuns(workspaceId: string, workflowId: string) {
    // First verify workflow exists and belongs to workspace
    await this.getWorkflow(workspaceId, workflowId);

    return await db.query.workflowRuns.findMany({
      where: { workflowId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getWorkflowRunDetails(
    workspaceId: string,
    workflowId: string,
    runId: string,
  ) {
    // Verify ownership
    await this.getWorkflow(workspaceId, workflowId);

    const runDetails = await db.query.workflowRuns.findFirst({
      where: { workflowId, id: runId },
      with: {
        event: true,
        steps: {
          orderBy: { createdAt: "asc" },
          with: {
            step: true,
          },
        },
      },
    });

    if (!runDetails) {
      throw new Error("Workflow run not found");
    }

    return runDetails;
  }
}

export const workflowService = new WorkflowService();
