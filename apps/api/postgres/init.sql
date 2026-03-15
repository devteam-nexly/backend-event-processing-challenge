-- Initial schema for the events database.
-- Candidates are expected to extend this schema as needed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   UUID UNIQUE,
    tenant_id  TEXT,
    type       TEXT NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}',
    status     TEXT NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_pending_idx
ON events(status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS dlq_events (
    id BIGSERIAL PRIMARY KEY,
    event_row_id UUID REFERENCES events(id) ON DELETE SET NULL,
    event_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    retry_count INT NOT NULL,
    failure_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
