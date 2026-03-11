import pool from "../config/database.config";


export const eventRepository = {

    async fetchPending(limit = 10) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const result = await client.query(
                `
                SELECT *
                FROM events
                WHERE status = 'pending' or (status = 'failed' AND next_retry_at <= NOW())
                ORDER BY created_at
                LIMIT $1
                FOR UPDATE SKIP LOCKED`,
                [limit]
            );

            const ids = result.rows.map(e => e.id);

            if (ids.length) {
                await client.query(
                    `
                    UPDATE events
                    SET status = 'processing'
                    WHERE id = ANY($1)
                    `,
                    [ids]
                );
            }

            await client.query('COMMIT');

            return result.rows;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async markProcessed(id: string) {
        await pool.query(
            `UPDATE events 
            SET status = 'processed',
                processed_at = NOW()
            WHERE id = $1`,
            [id]
        );
    },

    async markFailed(id: string, error: string) {
        await pool.query(
            `
            UPDATE events
            SET retry_count = retry_count + 1,
                status = 'failed',
                last_error = $1,
                next_retry_at = NOW() + (INTERVAL '1 second' * POWER(2, retry_count))
            WHERE id = $2`,
            [error, id]
        );
    },

    async moveToDLQ(event: any, error: any) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            await client.query(
                `
                INSERT INTO dlq_events
                (original_event_id, tenant_id, type, payload, retry_count, last_error)
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    event.id,
                    event.tenant_id,
                    event.type,
                    event.payload,
                    event.retry_count,
                    error.message
                ]
            )

            await client.query(
                `DELETE FROM events WHERE id = $1`,
                [event.id]
            )
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};
