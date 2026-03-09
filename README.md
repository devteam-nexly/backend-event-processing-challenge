# Backend Event Processor Challenge

A base repository for the Nexly backend engineering technical challenge.

> **Candidates**: fork this repository and implement the challenge described in [`docs/challenge.md`](./docs/challenge.md).

---

## Stack

| Layer        | Technology               |
|--------------|--------------------------|
| Runtime      | Node.js 22               |
| Language     | TypeScript (strict)      |
| Framework    | Fastify 4                |
| Database     | PostgreSQL 16            |
| Container    | Docker + Docker Compose  |

---

## Project Structure

```
.
├── apps/
│   └── api/                    # Fastify API skeleton
│       └── src/
│           ├── server.ts       # Entry point
│           ├── app.ts          # Fastify instance and plugin registration
│           └── routes/
│               └── health.ts   # GET /health (implemented)
│
├── mock-integrations/          # Simulates unstable external services
│   └── src/
│       └── server.ts           # POST /billing, /crm, /notifications
│
├── scripts/
│   └── generate-events.ts      # Sends 10k synthetic events to the API
│
├── infra/
│   └── postgres/
│       └── init.sql            # Initial DB schema
│
├── docs/
│   └── challenge.md            # Challenge instructions
│
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Node.js 22+ (for running scripts locally)

### Run the environment

```bash
cp .env.example .env
docker compose up
```

This starts:

| Service            | Port  | Description                      |
|--------------------|-------|----------------------------------|
| `api`              | 3000  | Fastify API                      |
| `mock-integrations`| 4000  | Unstable external services mock  |
| `postgres`         | 5432  | PostgreSQL database              |

### Verify everything is running

```bash
curl http://localhost:3000/health
# {"status":"ok"}

curl http://localhost:4000/health
# {"status":"ok"}
```

---

## Mock Integrations

The `mock-integrations` service simulates three external systems: **billing**, **crm**, and **notifications**.

All three endpoints share the same behavior:

| Behavior          | Probability | Description                            |
|-------------------|-------------|----------------------------------------|
| Success           | ~77%        | Returns `200 OK` after a random delay  |
| Rate limited      | ~8%         | Returns `429` with `Retry-After: 5`    |
| Server error      | ~15%        | Returns `500 Internal Server Error`    |
| Latency           | Always      | Random delay between 0–3 seconds       |

Your implementation must handle all of these cases.

### Endpoints

```
POST http://localhost:4000/billing
POST http://localhost:4000/crm
POST http://localhost:4000/notifications
```

---

## Event Generator

Located at `scripts/generate-events.ts`, this script sends synthetic events to the API for load testing.

### Setup

Install root dependencies once:

```bash
npm install
```

### Usage

```bash
# Default: 10,000 events, 20 concurrent
npm run generate-events

# Custom count
npm run generate-events -- --count 1000

# Custom count and concurrency
npm run generate-events -- --count 5000 --concurrency 50
```

### Configuration

CLI arguments take priority over environment variables, which take priority over defaults.

| CLI argument    | Env variable   | Default | Description                  |
|-----------------|----------------|---------|------------------------------|
| `--count`       | `TOTAL_EVENTS` | `10000` | Number of events to send     |
| `--concurrency` | `CONCURRENCY`  | `20`    | Simultaneous requests        |
| —               | `API_URL`      | `http://localhost:3000` | Base URL of the API |

---

## Challenge

Read [`docs/challenge.md`](./docs/challenge.md) for the full requirements.

In summary, you must implement:

1. `POST /events` — event ingestion endpoint
2. An asynchronous event processor
3. Retry logic with exponential backoff
4. Dead Letter Queue (DLQ) for unprocessable events
5. `GET /metrics` and `GET /dlq` endpoints

---

## Development

### Running the API locally (without Docker)

```bash
cd apps/api
npm install
cp ../../.env.example .env
npm run dev
```

### Running mock integrations locally

```bash
cd mock-integrations
npm install
npm run dev
```

### Type checking

```bash
cd apps/api && npm run typecheck
cd mock-integrations && npm run typecheck
```

---

*Nexly Engineering Team*
