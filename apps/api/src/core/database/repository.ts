import { Pool, PoolClient } from 'pg';
import { AcceptedEventType, IncomingEvent, PersistedEvent, DlqEvent } from '../interfaces';

export type { DlqEvent };

interface EventRow {
  id: string;
  event_id: string;
  tenant_id: string;
  type: AcceptedEventType;
  payload: Record<string, unknown>;
  retry_count: number;
}

export class EventsRepository {
  constructor(private readonly pool: Pool) {}

  async initSchema(): Promise<void> {
    await this.pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS event_id UUID,
      ADD COLUMN IF NOT EXISTS tenant_id TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_error TEXT,
      ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
    `);

    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS events_event_id_unique_idx
      ON events(event_id)
      WHERE event_id IS NOT NULL;
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS events_pending_idx
      ON events(status, next_attempt_at, created_at);
    `);

    await this.pool.query(`
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
    `);
  }

  async insertEvent(event: IncomingEvent): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO events(event_id, tenant_id, type, payload, status, retry_count, next_attempt_at)
        VALUES ($1, $2, $3, $4::jsonb, 'pending', 0, NOW())
      `,
      [event.event_id, event.tenant_id, event.type, JSON.stringify(event.payload)],
    );
  }

  async claimPendingEvents(limit: number): Promise<PersistedEvent[]> {
    const result = await this.pool.query<EventRow>(
      `
        WITH candidates AS (
          SELECT id
          FROM events
          WHERE status IN ('pending', 'retrying')
            AND next_attempt_at <= NOW()
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE events e
        SET status = 'processing'
        FROM candidates c
        WHERE e.id = c.id
        RETURNING e.id, e.event_id, e.tenant_id, e.type, e.payload, e.retry_count
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      tenantId: row.tenant_id,
      type: row.type,
      payload: row.payload,
      retryCount: row.retry_count,
    }));
  }

  async markProcessed(eventRowId: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE events
        SET status = 'processed',
            processed_at = NOW(),
            last_error = NULL
        WHERE id = $1
      `,
      [eventRowId],
    );
  }

  async scheduleRetry(
    eventRowId: string,
    retryCount: number,
    nextAttemptAt: Date,
    errorMessage: string,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE events
        SET status = 'retrying',
            retry_count = $2,
            next_attempt_at = $3,
            last_error = $4
        WHERE id = $1
      `,
      [eventRowId, retryCount, nextAttemptAt.toISOString(), errorMessage],
    );
  }

  async markFailedAndMoveToDlq(
    event: PersistedEvent,
    finalRetryCount: number,
    failureReason: string,
  ): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
          UPDATE events
          SET status = 'failed',
              retry_count = $2,
              last_error = $3
          WHERE id = $1
        `,
        [event.id, finalRetryCount, failureReason],
      );

      await client.query(
        `
          INSERT INTO dlq_events(event_row_id, event_id, tenant_id, type, payload, retry_count, failure_reason)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        `,
        [
          event.id,
          event.eventId,
          event.tenantId,
          event.type,
          JSON.stringify(event.payload),
          finalRetryCount,
          failureReason,
        ],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listDlqEvents(): Promise<DlqEvent[]> {
    const result = await this.pool.query<DlqEvent>(
      `
        SELECT id,
               event_id::text,
               tenant_id,
               type,
               payload,
               retry_count,
               failure_reason,
               created_at::text
        FROM dlq_events
        ORDER BY created_at DESC
      `,
    );

    return result.rows;
  }

  async getMetrics(): Promise<{
    processed: number;
    failed: number;
    dlq: number;
    pending: number;
  }> {
    const eventCounts = await this.pool.query<{ status: string; count: string }>(
      `
        SELECT status, COUNT(*)::text AS count
        FROM events
        GROUP BY status
      `,
    );

    const dlqCount = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM dlq_events`,
    );

    const countsByStatus = new Map(eventCounts.rows.map((row) => [row.status, Number(row.count)]));

    const pending =
      (countsByStatus.get('pending') ?? 0) +
      (countsByStatus.get('retrying') ?? 0) +
      (countsByStatus.get('processing') ?? 0);

    return {
      processed: countsByStatus.get('processed') ?? 0,
      failed: countsByStatus.get('failed') ?? 0,
      dlq: Number(dlqCount.rows[0]?.count ?? 0),
      pending,
    };
  }
}
