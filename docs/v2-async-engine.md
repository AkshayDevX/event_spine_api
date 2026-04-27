# Phase 2: The Distributed System (v2-async-engine)

This document tracks the progression from Phase 1 (a fire-and-forget promise executor) to Phase 2, introducing a robust, distributed background worker architecture and real-time frontend streaming.

## 1. BullMQ & Redis Integration

In the MVP, webhooks were processed using simple detached asynchronous promises in the Node.js event loop. This posed a huge risk: if the API server crashed, any running webhooks were permanently lost. 

To solve this, we migrated to **BullMQ** backed by **Redis**:
- **Durability:** Incoming webhooks are immediately inserted into a BullMQ `webhooks` queue before responding to the caller with a `202 Accepted`. 
- **Retry Logic:** BullMQ's built-in retry mechanisms guarantee execution delivery even if downstream actions momentarily fail.
- **Docker Integration:** Updated the `compose.yml` to include a Redis container configured with `appendonly yes` (AOF) for persistent storage across container restarts.

## 2. Decoupling the API and Worker

We decoupled the execution layer into a separate background worker script (`src/modules/queue/worker.service.ts`). 
- **API Server:** Solely responsible for receiving requests, validating payloads, authenticating users, and pushing jobs to the queue.
- **Background Worker:** Solely responsible for popping jobs off the queue, interacting with the Drizzle ORM, executing external HTTP requests or filters, and updating the database state machine.
- **Dev Workflow:** Introduced `concurrently` in `package.json` and customized the `Makefile` so that a single `make dev` command effortlessly spins up the Fastify API, the Worker process, and the Redis database simultaneously.

## 3. Real-Time Streaming via WebSockets and Pub/Sub

Because the execution logic was moved out of the API server's event loop and into a detached process, the UI would normally have to aggressively poll the API to get workflow execution status. 

To create a magical, real-time dashboard experience, we implemented a sophisticated streaming pipeline:
- **WebSocket Route:** The Fastify API exposes an authenticated WebSocket endpoint at `ws://.../v1/live/workflows/:workflowId?token=JWT`. 
- **Redis Pub/Sub:** 
  - The **Worker** uses a Redis `pubClient` to broadcast typed JSON events (`workflow.started`, `step.running`, `step.completed`, `step.failed`, etc.) to specific Redis channels like `workflow:<workflowId>:live` as it executes jobs.
  - The **API** uses a Redis `subClient` to listen to those specific channels based on connected clients, and immediately pipes the events down the WebSocket connection to the frontend.

## 4. Architectural Outcomes

1. **Scalability:** We can now scale the API server independently from the background workers. If we anticipate a massive spike in webhooks, we can spin up 10 worker containers and 2 API containers without modifying the code.
2. **Resilience:** Crashing the API server no longer kills active workflow executions.
3. **UX Excellence:** Despite the decoupling, the end-user on the dashboard receives millisecond-latency progress updates via WebSockets as their multi-step workflow churns through data.
