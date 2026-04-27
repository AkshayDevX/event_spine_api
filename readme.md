# EventSpine

EventSpine is a developer-first data pipeline (like a lightweight Zapier/Make tailored for devs). Companies send high-volume Webhooks (e.g., from Stripe, Shopify) to the platform. EventSpine securely ingests them, transforms the payload based on user-defined steps, and reliably forwards them to internal servers or 3rd party APIs.

## Tech Stack

- **Framework:** Fastify
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Authentication:** JWT (with bcrypt hashing)
- **Message Broker:** Redis & BullMQ
- **Automated Testing:** Vitest
- **API Documentation:** Swagger (via `@fastify/swagger`)

## The Development Journey

This section logs the progression of the project from a basic MVP to a scalable, Enterprise-grade webhook pipeline. My methodology is broken down into structured phases.

---

### Phase 1: v1-mvp (The Foundation + Async Execution Engine)

_Status: Complete_

Established the foundational backend architecture, database schemas, and multi-tenant capabilities. Evolved the synchronous webhook handler into an enterprise-grade asynchronous pipeline with a real step executor and strict TypeScript.

- Multi-tenant workspace architecture with JWT authentication
- Asynchronous webhook processing with `202 Accepted` and fire-and-forget execution
- Database state machine for full execution lifecycle tracking
- Real step executor supporting `http_request` and `filter` actions
- Execution visibility APIs with step-level audit trails
- Zero `any` types — strict TypeScript across the entire codebase
- Drizzle RQB v2 relational queries
- Vitest test suite — 29 tests covering executor unit tests and integration tests

👉 **[Read the full feature logs for v1-mvp here.](./docs/v1-mvp.md)**

---

### Phase 2: v2-async-engine (The Distributed System)

_Status: Complete_

Refactored the execution flow from detached promises to reliable, distributed background jobs, and implemented real-time execution streaming.

- **Redis & BullMQ** — replaced the fire-and-forget promise with a durable job queue for guaranteed delivery.
- **Background Worker** — separated the API server from the worker processes for independent scaling.
- **WebSockets & Pub/Sub** — built real-time workflow progress streaming using `@fastify/websocket` and Redis Pub/Sub.
- **Dockerized Redis** — added persistent Redis AOF configurations to `compose.yml` with health checks.
- **Dev Tooling** — optimized multi-process development with `concurrently` and an enhanced `Makefile`.

👉 **[Read the full feature logs for v2-async-engine here.](./docs/v2-async-engine.md)**

---

### Phase 3: v3-enterprise (Application-Layer Resilience)

_Status: Pending_

Hardening the backend application to be production-ready at the code level before touching infrastructure.

- **Node.js Cluster mode** — spawn one Fastify process per CPU core using the native `cluster` API or PM2 cluster mode.
- **Strict per-tenant Rate Limiting** — `@fastify/rate-limit` keyed by `webhookPath` and `workspaceId` to prevent any single tenant from monopolizing queue capacity.
- **Idempotency Keys** — reject or deduplicate duplicate webhook deliveries using a Redis `SET NX` guard on a caller-provided `X-Idempotency-Key` header.
- **Circuit Breakers** — wrap outbound `http_request` step calls with `opossum` to stop hammering downstream APIs when they are degraded.
- **RBAC & Hierarchical API Keys** — workspace-scoped API keys with fine-grained permission scopes, replacing the current single JWT model.
- **Refresh Tokens** — short-lived access tokens with long-lived refresh tokens stored in the database.

---

### Phase 4: v4-infrastructure (Production-Grade Deployment)

_Status: Pending_

Moving from a single-machine deployment to a horizontally scalable, cloud-native infrastructure layer. **This phase is purely infrastructure — no new application code.**

- **Nginx Reverse Proxy** — sit Nginx in front of Fastify for SSL termination, connection rate limiting at the TCP layer, and upstream load balancing across the Node.js cluster processes.
- **Docker Compose → Kubernetes** — migrate from `compose.yml` to Kubernetes manifests (`Deployment`, `Service`, `ConfigMap`, `Secret`).
  - Fastify API pods and Webhook Worker pods are deployed as independent `Deployment` resources so they can scale independently.
  - `HorizontalPodAutoscaler` scales worker pods based on BullMQ Redis queue depth (custom metrics via KEDA).
- **KEDA (Kubernetes Event-Driven Autoscaling)** — automatically spin up more worker pods when the BullMQ queue backlog exceeds a defined threshold; scale back down when idle.
- **Ingress Controller** — replace the Nginx manual config with a Kubernetes `Ingress` + cert-manager for automated SSL via Let's Encrypt.
- **Secrets Management** — migrate `.env` secrets to Kubernetes `Secret` objects or HashiCorp Vault.
