import { defineRelations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { workspaces } from "./tenant";

export const WorkflowRunStatusEnum = pgEnum("status", [
  "pending",
  "running",
  "completed",
  "failed",
  "halted",
]);

export const actionTypeEnum = pgEnum("action_type", ["http_request", "filter"]);

// Workflows Table
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull().default("webhook"),
  webhookPath: text("webhook_path").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workflow Steps Table
export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  actionType: actionTypeEnum("action_type").notNull(),
  orderNumber: text("order_number").notNull().default("1"),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Webhook Events Table
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  payload: jsonb("payload").notNull(),
  headers: jsonb("headers").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workflow Runs Table
export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  webhookEventId: uuid("webhook_event_id").references(() => webhookEvents.id, {
    onDelete: "set null",
  }),
  status: WorkflowRunStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workflow Run Steps Table
export const workflowRunSteps = pgTable("workflow_run_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: uuid("workflow_run_id")
    .references(() => workflowRuns.id, { onDelete: "cascade" })
    .notNull(),
  stepId: uuid("step_id")
    .references(() => workflowSteps.id, { onDelete: "cascade" })
    .notNull(),
  status: WorkflowRunStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  logs: jsonb("logs"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workflow Relations
export const workflowRelations = defineRelations(
  {
    workflows,
    workflowSteps,
    workspaces,
    webhookEvents,
    workflowRuns,
    workflowRunSteps,
  },
  (r) => ({
    workflows: {
      workspace: r.one.workspaces({
        from: r.workflows.workspaceId,
        to: r.workspaces.id,
      }),
      steps: r.many.workflowSteps(),
      runs: r.many.workflowRuns(),
      events: r.many.webhookEvents(),
    },
    workflowSteps: {
      workflow: r.one.workflows({
        from: r.workflowSteps.workflowId,
        to: r.workflows.id,
      }),
    },
    workspaces: {
      workflows: r.many.workflows(),
    },
    webhookEvents: {
      workflow: r.one.workflows({
        from: r.webhookEvents.workflowId,
        to: r.workflows.id,
      }),
    },
    workflowRuns: {
      workflow: r.one.workflows({
        from: r.workflowRuns.workflowId,
        to: r.workflows.id,
      }),
      event: r.one.webhookEvents({
        from: r.workflowRuns.webhookEventId,
        to: r.webhookEvents.id,
      }),
      steps: r.many.workflowRunSteps(),
    },
    workflowRunSteps: {
      run: r.one.workflowRuns({
        from: r.workflowRunSteps.workflowRunId,
        to: r.workflowRuns.id,
      }),
      step: r.one.workflowSteps({
        from: r.workflowRunSteps.stepId,
        to: r.workflowSteps.id,
      }),
    },
  }),
);
