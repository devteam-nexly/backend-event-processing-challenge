# SOLUTION

## Architecture Decisions and Trade-offs

### Queue mechanism

The implementation uses PostgreSQL itself as a durable queue by extending the `events` table with processing state and scheduling metadata:

- `status`: `pending`, `processing`, `retrying`, `processed`, `failed`
- `retry_count`, `next_attempt_at`, `last_error`, `processed_at`

Trade-off:

- Pros: no extra infrastructure dependency, durable storage, simple local setup.
- Cons: lower throughput than dedicated message brokers for very high scale.

### Worker model

An in-process worker runs alongside the Fastify API and polls the database using `FOR UPDATE SKIP LOCKED` to safely claim events without duplicate concurrent processing.

Trade-off:

- Pros: low operational complexity and easy setup for this challenge.
- Cons: API and worker share compute resources; production setups usually isolate workers.

### Retry strategy

There are two retry layers:

- Request-level retries: retries integration calls with exponential backoff and honors `Retry-After` on `429`.
- Event-level retries: if the full processing attempt still fails, the event is rescheduled with exponential backoff.

Configured limits:

- `MAX_REQUEST_ATTEMPTS` (default `4`)
- `MAX_EVENT_ATTEMPTS` (default `5`)

Why this approach:

- Handles transient failures while preventing unbounded retries and runaway latency.

### DLQ strategy

A dedicated `dlq_events` table stores exhausted events with complete failure context:

- event identifiers and routing type
- payload snapshot
- retry count
- failure reason

Trade-off:

- Pros: durable, queryable, simple for troubleshooting.
- Cons: requires retention and replay strategy for production operation.

## What Was Implemented

### Endpoints

- `POST /events`: validates payload, persists event, returns `202 Accepted` immediately.
- `GET /metrics`: returns `{ processed, failed, dlq, pending }` counters.
- `GET /dlq`: returns dead-lettered events with context.
- `GET /health`: health check endpoint.

### Core behavior

- Asynchronous processing via background worker polling PostgreSQL queue.
- Event-type based routing to unstable integrations:
  - `order.*` -> `/billing` + `/crm`
  - `payment.*` -> `/billing`
  - `customer.*` -> `/crm` + `/notifications`
- Intelligent retries and DLQ fallback when limits are exhausted.
- Event deduplication via unique `event_id` index.

### Observability

Structured logs were added for:

- event accepted/enqueued
- processing started
- retry attempts
- successful completion
- DLQ routing

## How to Run

1. Start services:

```bash
cp .env.example .env
docker compose up --build
```

2. Send a sample event:

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "tenant_a",
    "type": "order.created",
    "payload": { "orderId": "ORD-001", "value": 199.90 }
  }'
```

3. Inspect runtime state:

```bash
curl http://localhost:3000/metrics
curl http://localhost:3000/dlq
```

4. Optional load test:

```bash
npm run generate-events -- --count 10000 --concurrency 50
```

## Notes from Validation Run

Local validation confirmed:

- `POST /events` returns `202`
- duplicate `event_id` returns `409`
- asynchronous processing increments `processed`
- `GET /dlq` returns exhausted events with failure details

## Improvements With More Time

- Add automated integration tests for retry and DLQ transitions.
- Move worker to a separate process/container.
- Add DLQ replay workflow and retention policy.
- Add richer metrics (latency histograms and per-integration counters).
- Introduce resilience patterns such as circuit breakers and bulkheads.
