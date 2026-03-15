import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EventsRepository } from '../../core/database';
import { IngestEventUseCase } from '../usecases';

export function registerEventRoutes(app: FastifyInstance, repo: EventsRepository): void {
  const ingestEventUseCase = new IngestEventUseCase(repo);

  app.post('/events', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await ingestEventUseCase.execute(request.body);

    if (result.logContext) {
      request.log.info(result.logContext, 'event received and enqueued');
    }

    await reply.code(result.statusCode).send(result.body);
  });
}
