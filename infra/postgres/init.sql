-- Initial schema for the events database.
-- Candidates are expected to extend this schema as needed.
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- adiciona colunas para controle de eventos
ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_id UUID UNIQUE,
    ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 4,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error TEXT;
-- Index para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_events_status_retry ON events (status, next_retry_at);
CREATE TABLE IF NOT EXISTS dlq_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_event_id UUID,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    retry_count INT NOT NULL,
    last_error TEXT,
    moved_to_dlq_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
