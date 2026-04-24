# Phase 1: v1-mvp Features

This document outlines the core features implemented during the foundational phase of **EventSpine**.

## 1. Multi-Tenant Architecture & Database Setup

- **Database Engine**: Set up local `PostgreSQL` using Docker Compose.
- **Schema Definition** (via `drizzle-orm`):
  - `Tenant System`: Created `users`, `workspaces`, and a junction table `workspace_members` allowing one user to belong to multiple workspaces with varying roles (`admin`, `member`).
  - `Workflow System`: Defined `workflows` (which generates the unique secret `webhookPath` for ingestion) and `workflow_steps` (holds the payload configuration and action mapping data).
- **Migrations**: Integrated `drizzle-kit` for automated database generation and schema migrations.

## 2. Authentication and Security

- **JWT**: Implemented `@fastify/jwt` for stateless token-based authorization.
- **Password Security**: Utilized `bcrypt` to securely salt and encrypt user passwords upon signup.
- **Auth Endpoints**: Built `/v1/auth/signup` and `/v1/auth/login` to manage user onboarding and automatic workspace bootstrapping.

## 3. Workflow Management API

- **CRUD Routes**: Added endpoints (`/v1/workflows`) protected by JWT Bearer tokens to create, view, and manage workflows.
- **Zod Validation**: Guarded incoming Fastify requests by enforcing strict schema requirements for workflow creations via Zod properties.

## 4. Synchronous Webhook Ingestion Engine

- **Public Endpoint**: Implemented the `POST /v1/hooks/:webhookPath` public catch-all endpoint serving as the webhook listener for external services like Stripe or Shopify.
- **Dynamic Payload Validation**: Added permissive Zod schemas allowing valid JSON payloads of varying unknown configurations into the system.
- **Synchronous Execution**: Tied the webhook URL triggering action directly to the database workflows index to immediately simulate step processing. _(To be scaled into reliable async background queues in `v2-async-engine`)._

## 5. Developer Experience (DX)

- **Interactive Tooling**: Configured `@fastify/swagger` and `@fastify/swagger-ui` to auto-generate beautiful, interactive API documentation dynamically mapped from the Fastify route schemas.
- **Type Safety**: Ensured 100% strict TypeScript compliance across all controllers, Zod inferences, and Drizzle ORM relational queries.
