import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EventsRepository } from '../../core/database';
import { GetMetricsUseCase } from '../usecases';

export function registerMetricsRoutes(app: FastifyInstance, repo: EventsRepository): void {
  const getMetricsUseCase = new GetMetricsUseCase(repo);

  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const metrics = await getMetricsUseCase.execute();
    await reply.send(metrics);
  });
}
