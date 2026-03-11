import 'dotenv/config';
import pool from "../../config/database.config";
import { EventBody } from "./events.schema";

export class EventsService {
    async createEvent(data: EventBody): Promise<void> {
        await pool.query(
            `
            INSERT INTO events (event_id, tenant_id, type, payload, status, retry_count)
            VALUES ($1,$2,$3,$4,'pending',0)
            ON CONFLICT (event_id) DO NOTHING
            `,
            [data.event_id, data.tenant_id, data.type, data.payload]
        );
        return;
    }
}
