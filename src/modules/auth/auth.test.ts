import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
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
      refreshTokens: {
        findFirst: vi.fn(),
      },
      apiKeys: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    transaction: vi.fn(),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "refresh-123",
            userId: "user-123",
            workspaceId: "ws-123",
          },
        ]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
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
let authToken: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "refresh-123",
            userId: "user-123",
            workspaceId: "ws-123",
          },
        ]),
      }),
    } as never);
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never);
  });

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
      expect(body).toHaveProperty("refreshToken");
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
      expect(body).toHaveProperty("refreshToken");
      expect(body.scopes).toContain("api_keys:manage");
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

  describe("POST /api/v1/auth/refresh", () => {
    it("should rotate refresh tokens", async () => {
      vi.mocked(db.query.refreshTokens.findFirst).mockResolvedValue({
        id: "refresh-123",
        userId: "user-123",
        workspaceId: "ws-123",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        user: {
          id: "user-123",
          email: "test@test.com",
        },
        workspace: {
          id: "ws-123",
          name: "Test Workspace",
          slug: "test-workspace",
        },
      } as never);
      vi.mocked(db.query.workspaceMembers.findFirst).mockResolvedValue({
        workspaceId: "ws-123",
        role: "owner",
        workspace: { id: "ws-123", name: "Test Workspace" },
      } as never);
      vi.mocked(db.transaction).mockImplementation(async (fn) => {
        return fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "refresh-456" }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        } as never);
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {
          refreshToken: "esp_rt_valid-refresh-token-value-that-is-long-enough",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
    });
  });

  describe("Session management", () => {
    it("should list active sessions and mark the current session", async () => {
      authToken = app.jwt.sign({
        id: "user-123",
        email: "test@test.com",
        workspaceId: "ws-123",
        sessionId: "refresh-123",
        role: "owner",
        scopes: ["workflow:read"],
      });
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "refresh-123",
              workspaceId: "ws-123",
              userAgent: "Vitest",
              ipAddress: "127.0.0.1",
              lastUsedAt: new Date(),
              expiresAt: new Date(Date.now() + 60_000),
              createdAt: new Date(),
            },
          ]),
        }),
      } as never);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/sessions",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().sessions).toMatchObject([
        {
          id: "refresh-123",
          current: true,
        },
      ]);
    });

    it("should revoke a single session for the current user", async () => {
      authToken = app.jwt.sign({
        id: "user-123",
        email: "test@test.com",
        workspaceId: "ws-123",
        sessionId: "refresh-123",
        role: "owner",
        scopes: ["workflow:read"],
      });
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "refresh-456" }]),
          }),
        }),
      } as never);

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/sessions/00000000-0000-0000-0000-000000000456",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it("should revoke all other sessions", async () => {
      authToken = app.jwt.sign({
        id: "user-123",
        email: "test@test.com",
        workspaceId: "ws-123",
        sessionId: "refresh-123",
        role: "owner",
        scopes: ["workflow:read"],
      });

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/auth/sessions/others",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe("POST /api/v1/auth/api-keys", () => {
    it("should create a scoped workspace API key for authorized users", async () => {
      authToken = app.jwt.sign({
        id: "user-123",
        email: "test@test.com",
        workspaceId: "ws-123",
        role: "owner",
        scopes: ["api_keys:manage"],
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "key-123",
              name: "CI key",
              keyPrefix: "abc123",
              scopes: ["workflow:read"],
              expiresAt: null,
              createdAt: new Date(),
            },
          ]),
        }),
      } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/api-keys",
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: "CI key",
          scopes: ["workflow:read"],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.key).toMatch(/^esp_live_/);
      expect(body.apiKey.scopes).toEqual(["workflow:read"]);
    });

    it("should reject API key management without the manage scope", async () => {
      authToken = app.jwt.sign({
        id: "user-123",
        email: "test@test.com",
        workspaceId: "ws-123",
        role: "viewer",
        scopes: ["workflow:read"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/api-keys",
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: "CI key",
          scopes: ["workflow:read"],
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
