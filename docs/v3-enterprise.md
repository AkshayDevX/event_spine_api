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

## 5. RBAC and Workspace API Keys

Workspace APIs now support explicit authorization scopes instead of relying only on a workspace-bearing JWT:

- User sessions include workspace role and permission scopes derived from workspace membership.
- Workspace roles map to fine-grained scopes: `workflow:read`, `workflow:write`, `workflow:execute`, and `api_keys:manage`.
- API keys are workspace-scoped, stored as SHA-256 hashes, and only return the raw `esp_live_...` credential at creation time.
- API keys can be created, listed, and revoked through `/api/v1/auth/api-keys`.
- Workflow management APIs accept either a scoped JWT access token or an `X-API-Key` credential.

Permissions are intentionally code-defined product capabilities rather than rows in a permissions table. Roles and API keys store assignments, while new permission types remain explicit application changes that go through code review, tests, and migrations only when the product surface actually expands.

## 6. Refresh Token Rotation

Authentication now separates short-lived access tokens from long-lived persisted refresh tokens:

- Signup and login return both `accessToken` and `refreshToken` while preserving the legacy `token` field for existing clients.
- Refresh tokens are stored hashed in PostgreSQL and expire after `REFRESH_TOKEN_TTL_DAYS`.
- `POST /api/v1/auth/refresh` rotates refresh tokens and revokes the old token in one transaction.
- `POST /api/v1/auth/logout` revokes the provided refresh token.
- Access-token lifetime is controlled by `ACCESS_TOKEN_TTL_SECONDS`.

## 7. Session Management

Refresh-token rows now also act as lightweight session records:

- Login and signup persist session metadata from the request user agent and IP address.
- Access tokens include the current `sessionId` so the API can identify the active session.
- `GET /api/v1/auth/sessions` lists active non-expired sessions and marks the current session.
- `DELETE /api/v1/auth/sessions/:id` revokes one session for the current user.
- `DELETE /api/v1/auth/sessions/others` revokes every other active session for the current user.

## 8. Verification

- TypeScript build passes.
- ESLint passes.
- Vitest passes with 39 tests, including coverage for rate limiting, idempotency dedupe, circuit breaker behavior, refresh-token rotation, session revocation, and API-key scope enforcement.

## Phase 4 Handoff: Infrastructure & Orchestration

Phase 3 concludes with a "Production-Hardened" application layer. The system is now logically decoupled and ready for a transition from process-based management (PM2) to container-based orchestration (Kubernetes).

### 1. Application Stability State

- **Decoupled Architecture**: API and Worker processes are stateless and communicate via Redis/BullMQ.
- **Tenant Isolation**: RBAC and API-Key scoping are enforced at the middleware level.
- **Resilience Mechanisms**: Rate-limiting, circuit breakers, and idempotency logic are baked into the application code.
- **Database Schema**: Fully migrated with Drizzle, supporting enterprise features like session management and audit-ready API keys.

### 2. Phase 4 Strategic Objectives

Phase 4 should focus exclusively on the infrastructure plane without altering the established application boundaries:

- **Containerization**: Transition from `make dev` to multi-stage Docker builds optimized for size and security.
- **Orchestration**: Deploy to Kubernetes using Helm charts for the API (horizontal scaling) and Workers (concurrency-based scaling).
- **Traffic Management**: Implementation of Ingress controllers, TLS termination, and global load balancing.
- **Environment & Secrets**: Migration from `.env` files to Kubernetes Secrets and ConfigMaps (or HashiCorp Vault).
- **Observability 2.0**: Transition from local logging to a centralized stack (e.g., Prometheus for metrics, Grafana for dashboards, and ELK/Loki for logs).

**Handoff Status**: The application is officially "Infrastructure Agnostic."
