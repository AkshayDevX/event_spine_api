import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app";
import type { FastifyInstance } from "fastify";

// Mock the database module
vi.mock("../../../drizzle", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      workspaceMembers: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
    insert: vi.fn(),
  },
}));

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn(),
  },
}));

import { db } from "../../../drizzle";
import bcrypt from "bcrypt";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Auth Routes", () => {
  describe("POST /api/v1/auth/signup", () => {
    it("should return 201 with token on successful signup", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@test.com",
        fullName: "Test User",
      };
      const mockWorkspace = {
        id: "ws-123",
        name: "Test Workspace",
        slug: "test-workspace",
      };

      // Mock the transaction to return user and workspace
      vi.mocked(db.transaction).mockImplementation(async (fn) => {
        return fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValueOnce([mockUser]).mockResolvedValueOnce([mockWorkspace]),
            }),
          }),
        } as never);
      });

      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: "test@test.com",
          password: "password123",
          fullName: "Test User",
          workspaceName: "Test Workspace",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("token");
      expect(body.user.email).toBe("test@test.com");
      expect(body.workspace.name).toBe("Test Workspace");
    });

    it("should return 400 when required fields are missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: "test@test.com",
          // missing password, fullName, workspaceName
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should return token on valid credentials", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@test.com",
        hashedPassword: "hashed_password",
      };

      vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as never);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(db.query.workspaceMembers.findFirst).mockResolvedValue({
        workspaceId: "ws-123",
        workspace: { id: "ws-123", name: "Test" },
      } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "test@test.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("token");
    });

    it("should return 401 on invalid credentials", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "wrong@test.com",
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
