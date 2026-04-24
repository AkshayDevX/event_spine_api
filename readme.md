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

### Phase 1: v1-mvp (The Foundation)

_Status: Complete_

Established the foundational backend architecture, database schemas, and multi-tenant capabilities. Built the core trigger/action concepts allowing synchronous webhook ingestions.
👉 **[Read the full feature logs for v1-mvp here.](./docs/v1-mvp.md)**

---

### Phase 2: v2-async-engine (The Distributed System)

_Status: Pending_

Refactoring the execution flow from synchronus API calls to reliable, background asynchronous jobs.

- Planned features: Intoduction of Redis & BullMQ, exponential backoff retries, decoupling of Publishers/Subscribers, and Dead Letter Queues (DLQ).

---

### Phase 3: v3-enterprise (Application-Layer Resilience)

_Status: Pending_

Hardening the backend application to be production-ready at the code level before touching infrastructure.

- **Node.js Cluster mode** — spawn one Fastify process per CPU core using the native `cluster` API or PM2 cluster mode.
- **Real Step Executor** — replace the `setTimeout` mock in `webhook.worker.ts` with a real `StepExecutor` dispatching on `actionType` (e.g. `http_request`, `log_payload`).
- **Strict per-tenant Rate Limiting** — `@fastify/rate-limit` keyed by `webhookPath` and `workspaceId` to prevent any single tenant from monopolizing queue capacity.
- **Idempotency Keys** — reject or deduplicate duplicate webhook deliveries using a Redis `SET NX` guard on a caller-provided `X-Idempotency-Key` header.
- **Circuit Breakers** — wrap outbound `http_request` step calls with `opossum` to stop hammering downstream APIs when they are degraded.
- **RBAC & Hierarchical API Keys** — workspace-scoped API keys with fine-grained permission scopes, replacing the current single JWT model.

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
