import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EventBody, EventBodySchema } from './events.schema';
import { EventsService } from './events.service';

export async function eventRoutes(app: FastifyInstance): Promise<void> {
    const eventsService = new EventsService();

    app.get('/', async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await reply.send({ status: 'ok' });
    });

    app.post(
        '/',
        { schema: { body: EventBodySchema } },
        async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
            const body = request.body;
            await eventsService.createEvent(body as EventBody);
            await reply.status(202).send({ accepted: true });
        }
    );
}
