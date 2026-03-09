-- Initial schema for the events database
-- Candidates are expected to extend this schema as needed

CREATE TABLE IF NOT EXISTS events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL UNIQUE,
    tenant_id   VARCHAR(255) NOT NULL,
    type        VARCHAR(255) NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    status      VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_id  ON events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_type        ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_status      ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_created_at  ON events (created_at);
