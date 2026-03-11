import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => {
    return pool.query(text, params);
};

export const getClient = () => pool.connect();

export default pool;
