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
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "event-123" }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../queue/queue", () => ({
  webhookQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
  },
}));

import { db } from "../../../drizzle";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Webhook Routes", () => {
  describe("POST /api/v1/hooks/:webhookPath", () => {
    it("should return 404 for unknown webhook path", async () => {
      vi.mocked(db.query.workflows.findFirst).mockResolvedValue(undefined);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/hooks/unknown-path",
        payload: { event: "test" },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.message).toContain("not found");
    });

    it("should return 404 for inactive workflow", async () => {
      vi.mocked(db.query.workflows.findFirst).mockResolvedValue({
        id: "wf-123",
        name: "Inactive Workflow",
        isActive: false,
        steps: [],
      } as never);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/hooks/inactive-path",
        payload: { event: "test" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 202 Accepted for valid webhook path", async () => {
      const mockWorkflow = {
        id: "wf-123",
        name: "Test Workflow",
        isActive: true,
        steps: [
          {
            id: "step-1",
            actionType: "filter",
            orderNumber: "1",
            config: { key: "event", operator: "equals", value: "test" },
          },
        ],
      };

      vi.mocked(db.query.workflows.findFirst).mockResolvedValue(
        mockWorkflow as never,
      );

      // Mock insert to return event and run records
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValueOnce([{ id: "event-123" }])
            .mockResolvedValueOnce([{ id: "run-123" }]),
        }),
      });
      vi.mocked(db.insert).mockImplementation(insertMock);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/hooks/valid-path",
        payload: { event: "payment.succeeded" },
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe("Webhook accepted for processing");
      expect(body).toHaveProperty("runId");
    });
  });
});
