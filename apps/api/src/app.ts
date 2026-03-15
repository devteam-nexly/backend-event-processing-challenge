import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { healthRoutes } from './infra/routes/health';
import { createDbPool, EventsRepository } from './core/database';
import { registerEventRoutes } from './infra/routes/events';
import { registerDlqRoutes } from './infra/routes/dlq';
import { registerMetricsRoutes } from './infra/routes/metrics';
import { startEventWorker } from './infra/worker';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(sensible);

  const dbPool = createDbPool();
  const eventsRepository = new EventsRepository(dbPool);
  await eventsRepository.initSchema();

  const stopWorker = startEventWorker(eventsRepository, app.log);

  await app.register(healthRoutes, { prefix: '/health' });
  registerEventRoutes(app, eventsRepository);
  registerDlqRoutes(app, eventsRepository);
  registerMetricsRoutes(app, eventsRepository);

  app.addHook('onClose', async () => {
    stopWorker();
    await dbPool.end();
  });

  return app;
}
