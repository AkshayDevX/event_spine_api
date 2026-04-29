# Phase 4: v4-infrastructure Features

This document tracks the infrastructure and orchestration work for **EventSpine**. The focus is on containerization, high availability, and cloud-native scaling. With the transition to Docker and Kubernetes, **PM2 has been fully removed** from the project to ensure a clean, container-first architecture.

## 1. Multi-Stage Containerization

The application is now fully dockerized using a multi-stage `Dockerfile`:

- **Stage 1 (Builder)**: Compiles TypeScript and installs all dependencies on `node:24-alpine`.
- **Stage 2 (Runner)**: Minimal production image containing only compiled code and production dependencies.
- **Outcome**: Small image size (~150MB), reduced attack surface, and repeatable builds.

## 2. Nginx Load Balancing

A reverse proxy layer sits in front of the API instances:

- **Load Balancing**: Distributes incoming traffic across multiple API containers using round-robin.
- **Rate Limiting**: Nginx-level rate limiting (`10r/s`) prevents DDoS and misbehaving clients before they hit the Node.js process.
- **Resilience**: Automatically detects failed upstream nodes and routes traffic to healthy ones.
- **Security**: Implements standard headers like `X-Frame-Options` and `nosniff`.



## 3. Distributed Scaling (Docker Compose)

The `compose.yml` now reflects a production-like cluster:

- **API Replicas**: Defaults to 2 instances for high availability.
- **Independent Workers**: Background workers scale separately from the API, sharing the same image but running a different entrypoint.
- **Migration Orchestration**: A `migrations` service runs once before the API boots to ensure the schema is up-to-date.

## 4. Kubernetes Orchestration

The system is ready for Kubernetes deployment via manifests in `/k8s`:

- **API Deployment**: Manages the API cluster with rolling updates.
- **Worker Deployment**: Manages background processing.
- **KEDA Autoscaling**: An event-driven autoscaler (`ScaledObject`) is configured to spin up more worker pods based on the Redis queue backlog.

## 5. Observability (Infrastructure & Application)
 
 The system includes a full-stack observability suite:
 
- **Application Instrumentation**: Integrated `fastify-metrics` to expose real-time application data at `/metrics`.
- **Metrics Collection (Prometheus)**: Automatically scrapes API (load-balanced) and Worker metrics every 15 seconds.
- **Visualization (Grafana)**: Accessible at `http://localhost:3001` (login: `admin`/`admin`). Pre-configured with Prometheus as the default data source.
- **Health Checks**: All containers include liveness/readiness probes at `/api/v1/health` (API) and `/health` (Worker).

## 6. Cloud-Native Readiness (Next Steps)

To transition from local Docker Compose to a full-scale cloud environment (AWS EKS, GCP GKE), the following components are prioritized:

- **Ingress Controller**: Replacing the manual Nginx configuration with a Kubernetes `Ingress` + `cert-manager`. This enables automated SSL certificate management via Let's Encrypt and dynamic routing.
- **Secrets Management**: Migrating sensitive `.env` data to Kubernetes `Secret` objects. For high-security environments, integration with **HashiCorp Vault** is recommended for secret rotation and auditing.
- **Auto-scaling (KEDA)**: **[CONFIGURED]** The system includes a ready-to-use `ScaledObject` manifest. This enables the worker cluster to automatically spin up or down based on real-time BullMQ queue depth once deployed to a cluster with the KEDA operator.

## Handoff & Next Steps

The application is now **fully containerized** and **Cloud Agnostic**, ready for any modern container orchestration platform.

### Deployment Guide (Local Cluster)

1. Build the images:
   ```bash
   docker-compose build
   ```

2. Start the cluster:
   ```bash
   docker-compose up -d
   ```

3. Access the API via Nginx on `http://localhost:80`.

### Monitoring Guide

- **Grafana**: Visit `http://localhost:3001` (admin/admin). Prometheus is already linked.
- **Prometheus**: Visit `http://localhost:9090` to see raw metrics or check target health.
- **App Metrics**: Visit `http://localhost:80/metrics` (via Nginx) to see the raw instrumentation data.
