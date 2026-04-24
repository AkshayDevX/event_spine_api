import { defineRelations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { workspaces } from "./tenant";

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
  actionType: text("action_type").notNull(),
  orderNumber: text("order_number").notNull().default("1"),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workflow Relations
export const workflowRelations = defineRelations(
  { workflows, workflowSteps, workspaces },
  (r) => ({
    workflows: {
      workspace: r.one.workspaces({
        from: r.workflows.workspaceId,
        to: r.workspaces.id,
      }),
      steps: r.many.workflowSteps(),
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
  }),
);
