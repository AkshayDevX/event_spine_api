import { defineRelations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Users Table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspaces Table
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspace Members Table
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tenant Relations
export const tenantRelations = defineRelations(
  { users, workspaces, workspaceMembers },
  (r) => ({
    users: {
      workspaces: r.many.workspaces({
        from: r.users.id.through(r.workspaceMembers.userId),
        to: r.workspaces.id.through(r.workspaceMembers.workspaceId),
      }),
      workspaceMembers: r.many.workspaceMembers(),
    },
    workspaces: {
      members: r.many.users({
        from: r.workspaces.id.through(r.workspaceMembers.workspaceId),
        to: r.users.id.through(r.workspaceMembers.userId),
      }),
      workspaceMembers: r.many.workspaceMembers(),
    },
    workspaceMembers: {
      user: r.one.users({
        from: r.workspaceMembers.userId,
        to: r.users.id,
      }),
      workspace: r.one.workspaces({
        from: r.workspaceMembers.workspaceId,
        to: r.workspaces.id,
      }),
    },
  }),
);
