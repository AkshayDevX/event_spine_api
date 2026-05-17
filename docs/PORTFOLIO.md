# EventSpine: Enterprise-Grade Event Transformation Pipeline

**EventSpine** is a developer-first, high-performance data pipeline designed to ingest, transform, and route high-volume webhooks with mission-critical reliability. Built for developers who need the flexibility of a custom-coded solution with the robustness of an enterprise-grade platform.

---

## 🚀 Project Overview

### The Problem
Traditional webhook integration often involves brittle, synchronous code that fails under load, lacks visibility into execution history, and offers no native way to handle retries or complex transformations.

### The Solution
EventSpine provides a distributed, multi-tenant "spine" for your events. It detaches ingestion from execution using a robust queue-based architecture, ensuring that no webhook is ever lost, even during downstream outages.

---

## 🏗️ Core Architecture

EventSpine is built as a **Distributed Event-Driven System** using a producer-consumer pattern.

1.  **Ingestion Engine (API):** A high-performance Fastify server that validates incoming webhooks against security guards and immediately persists them to a durable queue (BullMQ/Redis), returning a `202 Accepted` in milliseconds.
2.  **Distributed Workers:** Horizontally scalable worker nodes that pull jobs from the queue, execute complex transformation logic (filters and actions), and audit every step.
3.  **Real-Time Monitoring:** Uses Redis Pub/Sub to stream live execution updates to a dashboard via WebSockets.
4.  **Database Layer:** PostgreSQL + Drizzle ORM provides a strict, relational schema for multi-tenant isolation and detailed audit logs.

---

## 🛠️ Tech Stack

-   **Backend:** Node.js, TypeScript, Fastify (High performance)
-   **Database:** PostgreSQL, Drizzle ORM (Type-safe migrations)
-   **Message Broker:** Redis, BullMQ (Durable job management)
-   **Security:** JWT, Argon2/Bcrypt, RBAC, Hashed API Keys
-   **Validation:** Zod (Runtime type safety)
-   **Testing:** Vitest (90%+ coverage on core logic)
-   **Observability:** Prometheus, Grafana, Fastify-Metrics
-   **Infrastructure:** Docker Compose, Kubernetes, Nginx, KEDA (Autoscaling)

---

## 🛡️ Enterprise-Grade Features

### 1. Resilience & Reliability
-   **BullMQ Integration:** Every event is persistent. Built-in retry logic ensures delivery even if target APIs are temporarily down.
-   **Circuit Breakers:** Prevents cascading failures by tripping after repeated outbound HTTP errors, protecting the system from hammering degraded services.
-   **Idempotency Guards:** Redis-backed deduplication prevents duplicate webhook deliveries from causing side effects.

### 2. Security & Multi-Tenancy
-   **Workspace Isolation:** Strict tenant-level isolation in the database schema.
-   **Advanced Auth:** Implementation of short-lived Access Tokens with rotated Refresh Tokens and revocable sessions.
-   **API Key Management:** Hashed storage for workspace-scoped API keys with granular permission scopes.
-   **Ingress Guards:** HMAC and signature validation for incoming webhooks.

### 3. Scalability & Performance
-   **KEDA-Ready:** Pre-configured Kubernetes `ScaledObject` for autoscaling worker pods based on real-time queue depth.
-   **Rate Limiting:** Redis-based admission control keyed by tenant and webhook path.
-   **Cluster Mode:** API nodes run in PM2 cluster mode to utilize multi-core server resources efficiently.

---

## 📊 Observability & DX

-   **Live Audit Trails:** Every workflow execution generates a detailed step-by-step audit log with input/output payloads and timing.
-   **Prometheus/Grafana:** Full-stack monitoring dashboard tracking request rates, queue latency, worker health, and error distribution.
-   **Swagger Documentation:** Auto-generated, interactive API documentation for all endpoints.

---

## 🛣️ Future Roadmap

-   **Visual Workflow Builder:** A drag-and-drop interface for non-technical stakeholders to design transformation steps.
-   **Custom Code Actions:** Sandboxed V8 environments for running custom TypeScript/JavaScript transformation logic within the pipeline.
-   **Cloud-Native Ingress:** Native integration with AWS EKS Ingress Controllers and Cert-Manager for automated SSL/TLS.

---

## 👨‍💻 Author
**Akshay P P** - *Lead Software Engineer*
