import { FastifyBaseLogger } from 'fastify';
import { EventsRepository } from '../../core/database';
import { PersistedEvent } from '../../core/interfaces';
import { callIntegrationWithRetry, integrationRoutes } from './http';

export async function processEvent(
  repo: EventsRepository,
  logger: FastifyBaseLogger,
  event: PersistedEvent,
): Promise<void> {
  logger.info({ eventId: event.eventId, type: event.type }, 'event processing started');

  const routes = integrationRoutes[event.type];
  for (const route of routes) {
    await callIntegrationWithRetry(logger, event, route);
  }

  await repo.markProcessed(event.id);
  logger.info({ eventId: event.eventId, type: event.type }, 'event processed successfully');
}
