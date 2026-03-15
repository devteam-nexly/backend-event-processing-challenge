# Backend Event Processor Challenge

Implementation of the solution for Nexly's asynchronous event processing technical challenge.

The original requirements are available in [docs/challenge.md](./docs/challenge.md), and the architecture decisions are documented in [SOLUTION.md](./SOLUTION.md).

---

## Stack

| Layer        | Technology               |
|--------------|--------------------------|
| Runtime      | Node.js 22               |
| Language     | TypeScript strict        |
| API          | Fastify 4                |
| Database     | PostgreSQL 16            |
| Queue        | PostgreSQL + SKIP LOCKED |
| Containers   | Docker + Docker Compose  |

---

## What Was Implemented

- `POST /events` with payload validation and `event_id` deduplication
- event persistence in PostgreSQL
- asynchronous background worker consuming pending events
- event type routing to the mock integrations
- retries with exponential backoff
- `Retry-After` support for `429` responses
- DLQ persisted in a dedicated table
- `GET /dlq` to inspect exhausted events
- `GET /metrics` with processing counters
- structured logs with the Fastify logger
- test coverage for validation, use cases, and worker behavior

### Endpoints

| Method | Route      | Description |
|--------|------------|-----------|
| `GET`  | `/health`  | API health check |
| `POST` | `/events`  | Receives, validates, and enqueues events |
| `GET`  | `/metrics` | Returns `{ processed, failed, dlq, pending }` |
| `GET`  | `/dlq`     | Lists events sent to the DLQ |

---

## Solution Flow

1. The API receives an event through `POST /events`.
2. The payload is validated against the accepted event types.
3. The event is persisted with initial status `pending`.
4. A background worker polls the queue using PostgreSQL.
5. The worker calls external integrations based on the event type.
6. Transient failures are retried with exponential backoff.
7. When the retry limit is reached, the event is moved to the DLQ.

### Type-Based Routing

| Event type    | Destination |
|---------------|---------|
| `order.*`     | `/billing` + `/crm` |
| `payment.*`   | `/billing` |
| `customer.*`  | `/crm` + `/notifications` |

---

## Project Structure

```text
.
├── apps/
│   └── api/
│       ├── postgres/init.sql
│       ├── src/
│       │   ├── app.ts
│       │   ├── server.ts
│       │   ├── core/
│       │   │   ├── database/
│       │   │   ├── errors/
│       │   │   ├── interfaces/
│       │   │   └── events.ts
│       │   └── infra/
│       │       ├── routes/
│       │       ├── usecases/
│       │       └── worker/
│       └── test/
├── mock-integrations/
├── scripts/
├── docs/
├── SOLUTION.md
└── docker-compose.yml
```

---

## How to Run

### Start Everything with Docker

```bash
cp .env.example .env
docker compose up --build
```

Exposed services:

| Service             | Port | Description |
|---------------------|------|-------------|
| `api`               | 3000 | Fastify API |
| `mock-integrations` | 4000 | Simulated unstable integrations |
| `postgres`          | 5432 | PostgreSQL database |

### Quick Verification

```bash
curl http://localhost:3000/health
curl http://localhost:4000/health
curl http://localhost:3000/metrics
curl http://localhost:3000/dlq
```

### Sample Event

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

Expected response:

```json
{ "status": "accepted" }
```

---

## Local Development

### API

```bash
cd apps/api
npm install
cp .env.example .env
npm run dev
```

### API with Debugging

```bash
docker compose -f docker-compose.yml -f docker-compose.debug.yml up --build
```

This exposes port `9229` so you can attach a debugger to the API container.

### Mock integrations

```bash
cd mock-integrations
npm install
npm run dev
```

---

## Tests and Quality

### API

```bash
cd apps/api
npm test
npm run test:coverage
npm run typecheck
npm run lint
```

### Event Generator

From the project root:

```bash
npm install
npm run generate-events
npm run generate-events -- --count 5000 --concurrency 50
```

---

## Mock Integrations

The integrations simulate unstable behavior to exercise worker resilience:

- success with random latency
- `500` errors
- rate limiting with `429` and a `Retry-After` header

Available routes:

```text
POST http://localhost:4000/billing
POST http://localhost:4000/crm
POST http://localhost:4000/notifications
```

---

## References

- [docs/challenge.md](./docs/challenge.md)
- [SOLUTION.md](./SOLUTION.md)
