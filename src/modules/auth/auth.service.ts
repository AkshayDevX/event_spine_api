import { db } from "../../../drizzle";
import {
  users,
  workspaces,
  workspaceMembers,
} from "../../../drizzle/schema/tenant";
import { SignupInput, LoginInput } from "./auth.schema";
import bcrypt from "bcrypt";
import { credentialService, SessionMetadata } from "./credential.service";
import { scopesForRole, WorkspaceRole } from "./permissions";

export class AuthService {
  async signup(data: SignupInput) {
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    return await db.transaction(async (tx) => {
      // 1. Create User
      const [newUser] = await tx
        .insert(users)
        .values({
          email: data.email,
          hashedPassword: await bcrypt.hash(data.password, 10),
          fullName: data.fullName,
        })
        .returning();

      // 2. Create Workspace
      const workspaceSlug = data.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      const [newWorkspace] = await tx
        .insert(workspaces)
        .values({
          name: data.workspaceName,
          slug: workspaceSlug,
        })
        .returning();

      // 3. Link User to Workspace as Owner
      await tx.insert(workspaceMembers).values({
        userId: newUser.id,
        workspaceId: newWorkspace.id,
        role: "owner",
      });

      return { user: newUser, workspace: newWorkspace };
    });
  }

  async login(data: LoginInput) {
    const user = await db.query.users.findFirst({
      where: { email: data.email },
    });

    if (!user || !(await bcrypt.compare(data.password, user.hashedPassword))) {
      throw new Error("Invalid credentials");
    }

    return user;
  }

  async getPrimaryWorkspaceForUser(userId: string) {
    const memberRecord = await db.query.workspaceMembers.findFirst({
      where: {
        userId,
      },
      with: {
        workspace: true,
      },
    });

    if (!memberRecord) {
      throw new Error("No workspace associated with user");
    }

    const role = (memberRecord.role ?? "owner") as WorkspaceRole;
    return {
      workspaceId: memberRecord.workspaceId,
      workspace: memberRecord.workspace,
      role,
      scopes: scopesForRole(role),
    };
  }

  async createSession(
    userId: string,
    workspaceId: string,
    metadata: SessionMetadata,
  ) {
    return await credentialService.createRefreshToken(
      userId,
      workspaceId,
      metadata,
    );
  }
}

export const authService = new AuthService();
