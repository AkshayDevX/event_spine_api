# Phase 3: v3-enterprise Features

This document tracks the application-layer resilience work for **EventSpine**. The focus is production hardening in the backend code before adding Phase 4 infrastructure.

## 1. PM2 API Cluster Mode

The API server is configured for PM2-managed cluster mode:

- `ecosystem.config.cjs` defines an `event-spine-api` process using `exec_mode: "cluster"`.
- `PM2_INSTANCES` can pin the API worker count; otherwise PM2 uses `max`.
- PM2 owns API worker restarts, memory restarts, and process supervision.
- The app entrypoint remains a normal single Fastify process, which keeps local development and tests simple.
- `event-spine-worker` remains in fork mode because BullMQ workers scale independently from API HTTP workers.

> PM2 must be installed either globally (`npm install -g pm2`) or locally (`npm install --save-dev pm2`) for the production management scripts to work correctly. The provided `make` commands support both configurations.

## 2. Tenant-Scoped Webhook Rate Limiting

Webhook ingestion now applies Redis-backed admission control before creating events, runs, or queue jobs:

- Rate-limit keys are scoped by `workspaceId` and `webhookPath`.
- The default window is `100` requests per `60` seconds.
- Limits are configurable with `WEBHOOK_RATE_LIMIT_MAX` and `WEBHOOK_RATE_LIMIT_WINDOW_SECONDS`.
- Exceeded limits return `429` with a `Retry-After` header.

## 3. Webhook Idempotency Keys

External providers can send `X-Idempotency-Key` to prevent duplicate deliveries from creating duplicate workflow runs:

- Keys are reserved with Redis `SET NX`.
- The key scope includes `workspaceId`, `webhookPath`, and the caller-provided idempotency key.
- Duplicates return `202 Accepted` with `duplicate: true` and are not enqueued.
- Retention is controlled by `IDEMPOTENCY_TTL_SECONDS`.

## 4. HTTP Request Circuit Breaker

Outbound `http_request` workflow steps now track repeated failures per method and URL:

- A circuit opens after `HTTP_CIRCUIT_FAILURE_THRESHOLD` consecutive failed calls.
- While open, execution fails fast without issuing another downstream request.
- Successful calls reset the circuit state.
- The open duration is controlled by `HTTP_CIRCUIT_RESET_TIMEOUT_MS`.

## 5. Verification

- TypeScript build passes.
- ESLint passes.
- Vitest passes with 33 tests, including coverage for rate limiting, idempotency dedupe, and circuit breaker behavior.

## Remaining Phase 3 Work

- RBAC and hierarchical workspace API keys.
- Refresh-token storage and rotation.
