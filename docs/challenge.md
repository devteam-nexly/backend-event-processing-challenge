# Backend Event Processor — Technical Challenge

## Overview

You have been given a skeleton project with a Fastify API, a PostgreSQL database, and a mock external services layer.

Your mission is to implement a resilient, production-grade event processing system on top of this infrastructure.

---

## What You Must Build

### 1. Event Ingestion Endpoint

Implement `POST /events` on the API.

The endpoint must:

- Accept the event payload described below
- Validate the payload
- Persist the event to PostgreSQL with status `pending`
- Enqueue it for asynchronous processing
- Return `202 Accepted` immediately — do not wait for processing

### 2. Asynchronous Event Processor

Implement a worker that:

- Picks up pending events from the queue
- Routes each event to the correct mock integration based on its type:

| Event type          | Integration     |
|---------------------|-----------------|
| `order.*`           | `POST /billing` + `POST /crm` |
| `payment.*`         | `POST /billing` |
| `customer.*`        | `POST /crm` + `POST /notifications` |

- Marks events as `processed` on success
- Handles failures gracefully (see Retry Logic below)

### 3. Retry Logic

The mock integrations are intentionally unstable (latency, 500s, 429s).

Your processor must:

- Retry failed requests with **exponential backoff**
- Respect the `Retry-After` header on HTTP 429
- Define a maximum number of retry attempts (your choice — justify it)
- Move events to a **Dead Letter Queue (DLQ)** after exhausting retries

### 4. Dead Letter Queue (DLQ)

Implement a DLQ mechanism for unprocessable events.

Requirements:

- Persist DLQ events separately (table, file, or in-memory — document your choice)
- Include the failure reason and retry count
- Expose `GET /dlq` to list DLQ events

### 5. Observability

Instrument your implementation:

- Structured JSON logs (use the existing Fastify logger)
- At minimum, log: event received, processing started, retry attempt, DLQ routing, success
- A `GET /metrics` endpoint returning basic counters: `processed`, `failed`, `dlq`, `pending`

---

## Event Payload

```json
{
  "event_id": "uuid-v4",
  "tenant_id": "tenant_a",
  "type": "order.created",
  "payload": {}
}
```

### Validation rules

| Field       | Required | Type   | Constraints              |
|-------------|----------|--------|--------------------------|
| `event_id`  | yes      | string | valid UUID v4            |
| `tenant_id` | yes      | string | non-empty string         |
| `type`      | yes      | string | must be a known type     |
| `payload`   | yes      | object | can be empty `{}`        |

### Accepted event types

- `order.created`
- `order.updated`
- `order.cancelled`
- `payment.approved`
- `payment.refused`
- `customer.registered`
- `customer.updated`

---

## Testing Your Implementation

### Start the environment

```bash
cp .env.example .env
docker compose up
```

### Send test events

```bash
# Single event
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "tenant_a",
    "type": "order.created",
    "payload": { "orderId": "ORD-001", "value": 199.90 }
  }'

# Load test (10k events, 50 concurrent)
cd scripts && npm install && npx tsx generate-events.ts
```

---

## Deliverables

1. Fork this repository and implement the challenge
2. Submit a pull request or share your fork URL
3. Include a `SOLUTION.md` at the root with:
   - Architecture decisions and trade-offs
   - Technology choices (queue mechanism, retry strategy, etc.)
   - How to run your solution
   - What you would improve given more time

---

## Evaluation Criteria

| Criteria              | Weight |
|-----------------------|--------|
| Correctness           | High   |
| Resilience & retries  | High   |
| Code quality          | High   |
| Observability         | Medium |
| Documentation         | Medium |
| Performance           | Medium |
| Test coverage         | Bonus  |

---

## Constraints

- Do not change the mock integrations behavior
- Do not change the database init schema (you may add tables)
- You may add any npm packages you need
- You may use any queue mechanism (in-process, Redis, PostgreSQL SKIP LOCKED, etc.)
- TypeScript strict mode must remain enabled

---

## Time Expectation

This challenge is designed to be completed in **4–6 hours**.

We value clean, well-reasoned code over completeness. If you run out of time, document what you would have done next.

---

*Nexly Engineering Team*
