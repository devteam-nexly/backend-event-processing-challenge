import pool from "../../config/database.config";

export class EventsRepository {
    async createEvent(data: any): Promise<void> {
        await pool.query(
            `
            INSERT INTO events (event_id, tenant_id, type, payload, status, retry_count)
            VALUES ($1,$2,$3,$4,'pending',0)
            ON CONFLICT (event_id) DO NOTHING
            `,
            [data.event_id, data.tenant_id, data.type, data.payload]
        );
    }

    async getDlqEvents(): Promise<any> {
        return await pool.query('SELECT * FROM dlq_events;');
    }

    async getMetrics(): Promise<any> {
        return await pool.query(`
            SELECT status, count(*) as count
            FROM events
            GROUP BY status
        `);
    }
}
