import 'dotenv/config';
import { buildApp } from './app';

const PORT = Number(process.env.API_PORT ?? 3000);
const HOST = '0.0.0.0';

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
