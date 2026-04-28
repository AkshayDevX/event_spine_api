import { db } from "../../../drizzle";
import { workflows, workflowSteps, workflowRuns } from "../../../drizzle/schema/workflow";
import { CreateWorkflowInput, UpdateWorkflowInput, AddStepInput, UpdateStepInput } from "./workflow.schema";
import crypto from "crypto";
import { count, and, ilike, eq, inArray } from "drizzle-orm";

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

      const stepsToInsert = data.steps.map((step, index) => ({
        workflowId: workflow.id,
        actionType: step.actionType,
        orderNumber: String(index + 1),
        config: step.config,
      }));

      const insertedSteps = await tx
        .insert(workflowSteps)
        .values(stepsToInsert)
        .returning();

      return { workflow, steps: insertedSteps };
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

  async getWorkflowRuns(
    workspaceId: string,
    workflowId: string,
    options: { page?: number; limit?: number } = {},
  ) {
    // First verify workflow exists and belongs to workspace
    await this.getWorkflow(workspaceId, workflowId);

    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const [totalCountResult] = await db
      .select({ count: count() })
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflowId));

    const total = totalCountResult.count;
    const totalPages = Math.ceil(total / limit);

    const runs = await db.query.workflowRuns.findMany({
      where: { workflowId },
      orderBy: { createdAt: "desc" },
      limit,
      offset,
    });

    return {
      runs,
      meta: { total, page, limit, totalPages },
    };
  }

  async getAllWorkspaceRuns(
    workspaceId: string,
    filters: { workflowId?: string; page?: number; limit?: number } = {},
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    // Get workflow IDs for this workspace
    const workspaceWorkflows = await db.query.workflows.findMany({
      where: { workspaceId },
      columns: { id: true },
    });

    const validWorkflowIds = workspaceWorkflows.map((w) => w.id);
    if (validWorkflowIds.length === 0) {
      return { runs: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    let queryWorkflowIds = validWorkflowIds;
    if (filters.workflowId && validWorkflowIds.includes(filters.workflowId)) {
      queryWorkflowIds = [filters.workflowId];
    } else if (filters.workflowId) {
      return { runs: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const whereClause = inArray(workflowRuns.workflowId, queryWorkflowIds);

    const [totalCountResult] = await db
      .select({ count: count() })
      .from(workflowRuns)
      .where(whereClause);

    const total = totalCountResult.count;
    const totalPages = Math.ceil(total / limit);

    const runs = await db.query.workflowRuns.findMany({
      where: { workflowId: { in: queryWorkflowIds } },
      orderBy: { createdAt: "desc" },
      limit,
      offset,
      with: {
        workflow: {
          columns: { name: true, triggerType: true, webhookPath: true },
        },
      },
    });

    return {
      runs,
      meta: { total, page, limit, totalPages },
    };
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
        workflow: true,
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

  async addStep(workspaceId: string, workflowId: string, data: AddStepInput) {
    await this.getWorkflow(workspaceId, workflowId); // Verify ownership

    const [step] = await db
      .insert(workflowSteps)
      .values({
        workflowId,
        actionType: data.actionType,
        orderNumber: data.orderNumber || "1",
        config: data.config,
      })
      .returning();

    return step;
  }

  async updateStep(workspaceId: string, workflowId: string, stepId: string, data: UpdateStepInput) {
    await this.getWorkflow(workspaceId, workflowId); // Verify ownership

    const [step] = await db
      .update(workflowSteps)
      .set({
        ...(data.actionType !== undefined && { actionType: data.actionType }),
        ...(data.orderNumber !== undefined && { orderNumber: data.orderNumber }),
        ...(data.config !== undefined && { config: data.config }),
        updatedAt: new Date(),
      })
      .where(and(eq(workflowSteps.id, stepId), eq(workflowSteps.workflowId, workflowId)))
      .returning();

    if (!step) {
      throw new Error("Step not found");
    }

    return step;
  }

  async deleteStep(workspaceId: string, workflowId: string, stepId: string) {
    await this.getWorkflow(workspaceId, workflowId); // Verify ownership

    const [deletedStep] = await db
      .delete(workflowSteps)
      .where(and(eq(workflowSteps.id, stepId), eq(workflowSteps.workflowId, workflowId)))
      .returning();

    if (!deletedStep) {
      throw new Error("Step not found");
    }
  }
}

export const workflowService = new WorkflowService();
