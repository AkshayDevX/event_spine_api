# Phase 1: v1-mvp Features

This document outlines the core features implemented during the foundational phase of **EventSpine**.

## 1. Multi-Tenant Architecture & Database Setup

- **Database Engine**: Set up local `PostgreSQL` using Docker Compose.
- **Schema Definition** (via `drizzle-orm`):
  - `Tenant System`: Created `users`, `workspaces`, and a junction table `workspace_members` allowing one user to belong to multiple workspaces with varying roles (`admin`, `member`).
  - `Workflow System`: Defined `workflows` (which generates the unique secret `webhookPath` for ingestion) and `workflow_steps` (holds the payload configuration and action mapping data).
  - `Execution Tracking`: Added `webhook_events` (immutable raw payload storage), `workflow_runs` (execution lifecycle with status enum: `pending`, `running`, `completed`, `failed`), and `workflow_run_steps` (per-step audit logs with timing and error data).
  - `PostgreSQL Enums`: Defined `WorkflowRunStatusEnum` and `actionTypeEnum` for type-safe status and action columns.
- **Migrations**: Integrated `drizzle-kit` for automated database generation and schema migrations.

## 2. Authentication and Security

- **JWT**: Implemented `@fastify/jwt` for stateless token-based authorization.
- **Password Security**: Utilized `bcrypt` to securely salt and encrypt user passwords upon signup.
- **Auth Endpoints**: Built `/v1/auth/signup` and `/v1/auth/login` to manage user onboarding and automatic workspace bootstrapping.

## 3. Workflow Management API

- **CRUD Routes**: Added endpoints (`/v1/workflows`) protected by JWT Bearer tokens to create, view, and manage workflows.
- **Zod Validation**: Guarded incoming Fastify requests by enforcing strict schema requirements for workflow creations via Zod properties.
- **Execution History APIs**: Added `GET /workflows/:id/runs` for listing run history and `GET /workflows/:id/runs/:runId` for detailed step-level audit trails.

## 4. Asynchronous Webhook Ingestion Engine

- **Public Endpoint**: Implemented the `POST /v1/hooks/:webhookPath` public catch-all endpoint serving as the webhook listener for external services like Stripe or Shopify.
- **Dynamic Payload Validation**: Added permissive Zod schemas allowing valid JSON payloads of varying unknown configurations into the system.
- **Fire-and-Forget Pattern**: The webhook handler returns `202 Accepted` immediately after persisting the raw event, then hands off execution to a detached background promise. This ensures fast HTTP responses regardless of workflow complexity.
- **Database State Machine**: Execution state is tracked in the database as the single source of truth. Runs transition through `pending` → `running` → `completed`/`failed`, with each step independently audited with timestamps and logs.

## 5. Real Step Executor

- **Factory Pattern**: Built an `executor.ts` module that dispatches step execution based on `actionType` using a clean switch-based registry pattern.
- **`http_request` Action**: Uses the native Node.js `fetch` API to forward webhook payloads to external URLs. Supports configurable `url`, `method`, and `headers`. Captures the full HTTP response and saves it to the step's `logs` column.
- **`filter` Action**: Evaluates conditional rules against the payload using operators (`equals`, `not_equals`, `contains`, `exists`). Supports dot-notation for nested JSON access (e.g., `user.payment.status`). Throws a `FilterFailedError` to gracefully halt the workflow without marking it as a system failure.
- **Typed Config Interfaces**: Each action type has a dedicated TypeScript interface (`HttpRequestConfig`, `FilterConfig`) unified under a `StepConfig` union type.

## 6. Developer Experience (DX)

- **Interactive Tooling**: Configured `@fastify/swagger` and `@fastify/swagger-ui` to auto-generate beautiful, interactive API documentation dynamically mapped from the Fastify route schemas.
- **Strict TypeScript**: Zero `any` types across all controllers, services, and the executor. All catch blocks use `unknown` with `instanceof Error` narrowing. JWT payloads are typed via a `JwtPayload` interface.
- **Drizzle RQB v2**: All relational queries use the latest object-based syntax for cleaner, more readable database access.
