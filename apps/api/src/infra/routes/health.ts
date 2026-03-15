import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GetHealthUseCase } from '../usecases';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const getHealthUseCase = new GetHealthUseCase();

  app.get('/', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await reply.send(getHealthUseCase.execute());
  });
}
