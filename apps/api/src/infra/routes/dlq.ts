import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EventsRepository } from '../../core/database';
import { ListDlqEventsUseCase } from '../usecases';

export function registerDlqRoutes(app: FastifyInstance, repo: EventsRepository): void {
  const listDlqEventsUseCase = new ListDlqEventsUseCase(repo);

  app.get('/dlq', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const items = await listDlqEventsUseCase.execute();
    await reply.send({ items });
  });
}
