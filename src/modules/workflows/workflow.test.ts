import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app";
import type { FastifyInstance } from "fastify";

// Mock the database module
vi.mock("../../../drizzle", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      workspaceMembers: { findFirst: vi.fn() },
      workflows: { findFirst: vi.fn(), findMany: vi.fn() },
      workflowRuns: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    transaction: vi.fn(),
    insert: vi.fn(),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ value: 2 }])
      })
    }),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { db } from "../../../drizzle";

let app: FastifyInstance;
let authToken: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Generate a valid JWT for authenticated requests
  authToken = app.jwt.sign({
    id: "user-123",
    email: "test@test.com",
    workspaceId: "ws-123",
  });
});

afterAll(async () => {
  await app.close();
});

describe("Workflow Routes", () => {
  describe("POST /api/v1/workflows", () => {
    it("should return 401 without auth token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/workflows",
        payload: {
          name: "Test Workflow",
          steps: [{ actionType: "http_request", config: { url: "https://example.com" } }],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 201 on successful workflow creation", async () => {
      const mockWorkflow = {
        id: "wf-123",
        name: "Test Workflow",
        webhookPath: "abc123",
        workspaceId: "ws-123",
      };
      const mockSteps = [{
        id: "step-123",
        actionType: "http_request",
        config: { url: "https://example.com" },
      }];

      vi.mocked(db.transaction).mockImplementation(async (fn) => {
        return fn({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValueOnce([mockWorkflow])
                .mockResolvedValueOnce(mockSteps),
            }),
          }),
        } as never);
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/workflows",
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: "Test Workflow",
          steps: [{ actionType: "http_request", config: { url: "https://example.com" } }],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.workflow.name).toBe("Test Workflow");
      expect(body.steps[0].actionType).toBe("http_request");
    });
  });

  describe("GET /api/v1/workflows", () => {
    it("should return list of workflows", async () => {
      const mockWorkflows = [
        {
          id: "wf-1",
          name: "Workflow 1",
          steps: [],
        },
        {
          id: "wf-2",
          name: "Workflow 2",
          steps: [],
        },
      ];

      vi.mocked(db.query.workflows.findMany).mockResolvedValue(
        mockWorkflows as never,
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/workflows",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.workflows).toHaveLength(2);
    });
  });

  describe("GET /api/v1/workflows/:id", () => {
    it("should return 404 when workflow not found", async () => {
      vi.mocked(db.query.workflows.findFirst).mockResolvedValue(undefined);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/workflows/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
