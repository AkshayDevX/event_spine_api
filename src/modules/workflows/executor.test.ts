import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeStep, FilterFailedError } from "./executor";

describe("Executor", () => {
  describe("executeStep routing", () => {
    it("should throw on unsupported actionType", async () => {
      await expect(
        executeStep("unknown_action", { url: "http://test.com" }, {}),
      ).rejects.toThrow("Unsupported actionType: unknown_action");
    });
  });

  describe("filter action", () => {
    it("should pass when equals condition is met", async () => {
      const result = await executeStep(
        "filter",
        { key: "status", operator: "equals", value: "active" },
        { status: "active" },
      );

      expect(result).toEqual({
        filter_passed: true,
        message: 'Payload matched filter: status equals active',
      });
    });

    it("should throw FilterFailedError when equals condition fails", async () => {
      await expect(
        executeStep(
          "filter",
          { key: "status", operator: "equals", value: "active" },
          { status: "inactive" },
        ),
      ).rejects.toThrow(FilterFailedError);
    });

    it("should pass when not_equals condition is met", async () => {
      const result = await executeStep(
        "filter",
        { key: "status", operator: "not_equals", value: "deleted" },
        { status: "active" },
      );

      expect(result).toHaveProperty("filter_passed", true);
    });

    it("should throw FilterFailedError when not_equals condition fails", async () => {
      await expect(
        executeStep(
          "filter",
          { key: "status", operator: "not_equals", value: "active" },
          { status: "active" },
        ),
      ).rejects.toThrow(FilterFailedError);
    });

    it("should pass when contains condition is met", async () => {
      const result = await executeStep(
        "filter",
        { key: "email", operator: "contains", value: "@gmail" },
        { email: "user@gmail.com" },
      );

      expect(result).toHaveProperty("filter_passed", true);
    });

    it("should throw FilterFailedError when contains condition fails", async () => {
      await expect(
        executeStep(
          "filter",
          { key: "email", operator: "contains", value: "@gmail" },
          { email: "user@yahoo.com" },
        ),
      ).rejects.toThrow(FilterFailedError);
    });

    it("should pass when exists condition is met", async () => {
      const result = await executeStep(
        "filter",
        { key: "name", operator: "exists" },
        { name: "John" },
      );

      expect(result).toHaveProperty("filter_passed", true);
    });

    it("should throw FilterFailedError when exists condition fails", async () => {
      await expect(
        executeStep(
          "filter",
          { key: "name", operator: "exists" },
          { email: "test@test.com" },
        ),
      ).rejects.toThrow(FilterFailedError);
    });

    it("should access nested keys via dot notation", async () => {
      const result = await executeStep(
        "filter",
        { key: "user.payment.status", operator: "equals", value: "paid" },
        { user: { payment: { status: "paid" } } },
      );

      expect(result).toHaveProperty("filter_passed", true);
    });

    it("should throw on unknown filter operator", async () => {
      await expect(
        executeStep(
          "filter",
          // @ts-expect-error — testing unsupported operator
          { key: "status", operator: "greater_than", value: 10 },
          { status: 20 },
        ),
      ).rejects.toThrow("Unknown filter operator: greater_than");
    });

    it("should throw when key and operator are missing", async () => {
      await expect(
        // @ts-expect-error — testing missing config fields
        executeStep("filter", {}, { status: "active" }),
      ).rejects.toThrow("Filter requires 'key' and 'operator' in config");
    });
  });

  describe("http_request action", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should make a POST request and return response", async () => {
      const mockResponse = { success: true, id: "123" };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(mockResponse)),
        }),
      );

      const result = await executeStep(
        "http_request",
        { url: "https://api.example.com/webhook" },
        { event: "payment.succeeded" },
      );

      expect(result).toEqual({
        status: 200,
        response: mockResponse,
      });

      expect(fetch).toHaveBeenCalledWith("https://api.example.com/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "payment.succeeded" }),
      });
    });

    it("should use custom method and headers from config", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve("{}"),
        }),
      );

      await executeStep(
        "http_request",
        {
          url: "https://api.example.com/data",
          method: "PUT",
          headers: { Authorization: "Bearer token123" },
        },
        { data: "test" },
      );

      expect(fetch).toHaveBeenCalledWith("https://api.example.com/data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token123",
        },
        body: JSON.stringify({ data: "test" }),
      });
    });

    it("should not send body for GET requests", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve("{}"),
        }),
      );

      await executeStep(
        "http_request",
        { url: "https://api.example.com/data", method: "GET" },
        { data: "test" },
      );

      expect(fetch).toHaveBeenCalledWith("https://api.example.com/data", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
    });

    it("should throw when HTTP response is not ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () =>
            Promise.resolve(JSON.stringify({ error: "Internal Server Error" })),
        }),
      );

      await expect(
        executeStep(
          "http_request",
          { url: "https://api.example.com/webhook" },
          {},
        ),
      ).rejects.toThrow("HTTP Request failed with status 500");
    });

    it("should throw when url is missing from config", async () => {
      await expect(
        // @ts-expect-error — testing missing url in config
        executeStep("http_request", {}, {}),
      ).rejects.toThrow("HTTP Request requires a 'url' in config");
    });

    it("should handle non-JSON response body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve("plain text response"),
        }),
      );

      const result = await executeStep(
        "http_request",
        { url: "https://api.example.com/webhook" },
        {},
      );

      expect(result).toEqual({
        status: 200,
        response: "plain text response",
      });
    });

    it("should open the circuit after repeated downstream failures", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve(JSON.stringify({ error: "unavailable" })),
      });
      vi.stubGlobal("fetch", fetchMock);

      const failingStep = () =>
        executeStep(
          "http_request",
          { url: "https://api.example.com/flaky" },
          {},
        );

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(failingStep()).rejects.toThrow(
          "HTTP Request failed with status 503",
        );
      }

      await expect(failingStep()).rejects.toThrow("Circuit breaker open");
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });
  });
});
