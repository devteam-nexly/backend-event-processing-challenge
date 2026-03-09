import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health';

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

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });

  // TODO: candidates must implement event ingestion and processing routes

  return app;
}
