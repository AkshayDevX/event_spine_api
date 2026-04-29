import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
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

vi.mock("./ingress-guards", () => {
  class RateLimitExceededError extends Error {
    constructor(
      message: string,
      public readonly retryAfterSeconds: number,
    ) {
      super(message);
      this.name = "RateLimitExceededError";
    }
  }

  class DuplicateWebhookError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DuplicateWebhookError";
    }
  }

  return {
    DuplicateWebhookError,
    RateLimitExceededError,
    enforceWebhookRateLimit: vi.fn().mockResolvedValue({
      limit: 100,
      remaining: 99,
    }),
    reserveIdempotencyKey: vi.fn().mockResolvedValue(undefined),
  };
});

import { db } from "../../../drizzle";
import { webhookQueue } from "../queue/queue";
import {
  DuplicateWebhookError,
  enforceWebhookRateLimit,
  RateLimitExceededError,
  reserveIdempotencyKey,
} from "./ingress-guards";

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
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(enforceWebhookRateLimit).mockResolvedValue({
        limit: 100,
        remaining: 99,
      });
      vi.mocked(reserveIdempotencyKey).mockResolvedValue(undefined);
    });

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
        workspaceId: "workspace-123",
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
        workspaceId: "workspace-123",
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
      expect(enforceWebhookRateLimit).toHaveBeenCalledWith({
        workspaceId: "workspace-123",
        webhookPath: "valid-path",
      });
      expect(webhookQueue.add).toHaveBeenCalledWith("process-workflow", {
        runId: "run-123",
        workflowId: "wf-123",
      });
    });

    it("should reserve caller-provided idempotency keys", async () => {
      vi.mocked(db.query.workflows.findFirst).mockResolvedValue({
        id: "wf-123",
        workspaceId: "workspace-123",
        name: "Test Workflow",
        isActive: true,
        steps: [],
      } as never);

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
        headers: { "x-idempotency-key": "delivery-123" },
        payload: { event: "payment.succeeded" },
      });

      expect(response.statusCode).toBe(202);
      expect(reserveIdempotencyKey).toHaveBeenCalledWith({
        workspaceId: "workspace-123",
        webhookPath: "valid-path",
        idempotencyKey: "delivery-123",
      });
    });

    it("should return 202 without enqueueing duplicate idempotency keys", async () => {
      vi.mocked(db.query.workflows.findFirst).mockResolvedValue({
        id: "wf-123",
        workspaceId: "workspace-123",
        name: "Test Workflow",
        isActive: true,
        steps: [],
      } as never);
      vi.mocked(reserveIdempotencyKey).mockRejectedValue(
        new DuplicateWebhookError("Duplicate webhook delivery ignored"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/hooks/valid-path",
        headers: { "x-idempotency-key": "delivery-123" },
        payload: { event: "payment.succeeded" },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({
        success: true,
        duplicate: true,
      });
      expect(webhookQueue.add).not.toHaveBeenCalled();
    });

    it("should return 429 when the tenant webhook rate limit is exceeded", async () => {
      vi.mocked(db.query.workflows.findFirst).mockResolvedValue({
        id: "wf-123",
        workspaceId: "workspace-123",
        name: "Test Workflow",
        isActive: true,
        steps: [],
      } as never);
      vi.mocked(enforceWebhookRateLimit).mockRejectedValue(
        new RateLimitExceededError(
          "Webhook rate limit exceeded for this workspace",
          30,
        ),
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/hooks/valid-path",
        payload: { event: "payment.succeeded" },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBe("30");
      expect(webhookQueue.add).not.toHaveBeenCalled();
    });
  });
});
