import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EventBody, EventBodySchema } from './events.schema';
import { EventsService } from './events.service';

export async function eventRoutes(app: FastifyInstance): Promise<void> {
    const eventsService = new EventsService();

    app.post(
        '/',
        { schema: { body: EventBodySchema } },
        async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
            const body: any = request.body;
            app.log.info({
                event_id: body.event_id,
                tenant_id: body.tenant_id,
                type: body.type
            }, 'Event received');
            await eventsService.createEvent(body as EventBody);
            await reply.status(202).send({ accepted: true });
        }
    );
}
