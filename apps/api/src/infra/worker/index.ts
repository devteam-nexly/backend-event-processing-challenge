import { FastifyBaseLogger } from 'fastify';
import { EventsRepository } from '../../core/database';
import { exponentialBackoff } from './http';
import { processEvent } from './processor';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 500);
const WORKER_BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 10);
const MAX_EVENT_ATTEMPTS = Number(process.env.MAX_EVENT_ATTEMPTS ?? 5);
const BASE_EVENT_RETRY_DELAY_MS = Number(process.env.BASE_EVENT_RETRY_DELAY_MS ?? 1000);

export function startEventWorker(repo: EventsRepository, logger: FastifyBaseLogger): () => void {
  let running = true;
  let processing = false;

  const tick = async (): Promise<void> => {
    if (!running || processing) {
      return;
    }

    processing = true;

    try {
      const events = await repo.claimPendingEvents(WORKER_BATCH_SIZE);

      for (const event of events) {
        try {
          await processEvent(repo, logger, event);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'unknown processing error';
          const nextRetryCount = event.retryCount + 1;

          if (nextRetryCount >= MAX_EVENT_ATTEMPTS) {
            await repo.markFailedAndMoveToDlq(event, nextRetryCount, errorMessage);
            logger.error(
              {
                eventId: event.eventId,
                type: event.type,
                retryCount: nextRetryCount,
                failureReason: errorMessage,
              },
              'event routed to DLQ after retry exhaustion',
            );
            continue;
          }

          const delayMs = exponentialBackoff(nextRetryCount, BASE_EVENT_RETRY_DELAY_MS);
          const nextAttemptAt = new Date(Date.now() + delayMs);

          await repo.scheduleRetry(event.id, nextRetryCount, nextAttemptAt, errorMessage);
          logger.warn(
            {
              eventId: event.eventId,
              type: event.type,
              retryCount: nextRetryCount,
              delayMs,
              failureReason: errorMessage,
            },
            'event scheduled for retry',
          );
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'worker tick failed');
    } finally {
      processing = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);

  void tick();

  return () => {
    running = false;
    clearInterval(interval);
  };
}
