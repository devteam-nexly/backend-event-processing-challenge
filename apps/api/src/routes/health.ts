import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await reply.send({ status: 'ok' });
  });
}
