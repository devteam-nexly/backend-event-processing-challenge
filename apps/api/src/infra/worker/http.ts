import { FastifyBaseLogger } from 'fastify';
import { AcceptedEventType } from '../../core/events';
import { PersistedEvent } from '../../core/interfaces';

export const MOCK_BASE_URL = process.env.MOCK_INTEGRATIONS_URL ?? 'http://localhost:4000';
export const MAX_REQUEST_ATTEMPTS = Number(process.env.MAX_REQUEST_ATTEMPTS ?? 4);
export const BASE_REQUEST_RETRY_DELAY_MS = Number(process.env.BASE_REQUEST_RETRY_DELAY_MS ?? 500);

interface IntegrationRequestError extends Error {
  retryable: boolean;
}

export const integrationRoutes: Record<AcceptedEventType, string[]> = {
  'order.created': ['/billing', '/crm'],
  'order.updated': ['/billing', '/crm'],
  'order.cancelled': ['/billing', '/crm'],
  'payment.approved': ['/billing'],
  'payment.refused': ['/billing'],
  'customer.registered': ['/crm', '/notifications'],
  'customer.updated': ['/crm', '/notifications'],
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function exponentialBackoff(attempt: number, baseMs: number): number {
  const factor = 2 ** Math.max(0, attempt - 1);
  return baseMs * factor;
}

export function parseRetryAfterToMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(retryAfterHeader);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
}

export async function callIntegrationWithRetry(
  logger: FastifyBaseLogger,
  event: PersistedEvent,
  route: string,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${MOCK_BASE_URL}${route}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          event_id: event.eventId,
          tenant_id: event.tenantId,
          type: event.type,
          payload: event.payload,
        }),
      });

      if (response.ok) {
        return;
      }

      if (response.status === 429 || response.status >= 500) {
        const retryAfterMs = parseRetryAfterToMs(response.headers.get('Retry-After'));
        const delayMs = retryAfterMs ?? exponentialBackoff(attempt, BASE_REQUEST_RETRY_DELAY_MS);

        lastError = new Error(
          `integration ${route} returned ${response.status} on attempt ${attempt}`,
        );

        if (attempt < MAX_REQUEST_ATTEMPTS) {
          logger.warn(
            { eventId: event.eventId, route, attempt, delayMs, statusCode: response.status },
            'retry attempt for integration request',
          );
          await delay(delayMs);
          continue;
        }
      }

      const nonRetryableError: IntegrationRequestError = Object.assign(
        new Error(`integration ${route} returned non-success status ${response.status}`),
        { retryable: false },
      );
      throw nonRetryableError;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown integration error';
      const likelyRetryableNetworkError = !(error instanceof Error && 'retryable' in error);

      lastError = new Error(
        `integration ${route} request failed on attempt ${attempt}: ${message}`,
      );

      if (likelyRetryableNetworkError && attempt < MAX_REQUEST_ATTEMPTS) {
        const delayMs = exponentialBackoff(attempt, BASE_REQUEST_RETRY_DELAY_MS);
        logger.warn(
          { eventId: event.eventId, route, attempt, delayMs, error: message },
          'retry attempt after integration network failure',
        );
        await delay(delayMs);
        continue;
      }

      if (!likelyRetryableNetworkError) {
        throw error;
      }
    }
  }

  const exhaustedError: IntegrationRequestError = Object.assign(
    new Error(lastError?.message ?? 'integration retries exhausted'),
    { retryable: true },
  );

  throw exhaustedError;
}
