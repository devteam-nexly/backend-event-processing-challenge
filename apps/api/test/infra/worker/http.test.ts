import assert from 'node:assert/strict';
import test from 'node:test';

import {
  callIntegrationWithRetry,
  delay,
  exponentialBackoff,
  parseRetryAfterToMs,
} from '../../../src/infra/worker/http';

const event = {
  id: 'row-1',
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  tenantId: 'tenant_a',
  type: 'order.created' as const,
  payload: { orderId: 'ORD-1' },
  retryCount: 0,
};

function createLogger() {
  const warns: Array<{ context: unknown; message: string }> = [];

  return {
    logger: {
      warn: (context: unknown, message: string) => warns.push({ context, message }),
      info: () => undefined,
      error: () => undefined,
    },
    warns,
  };
}

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;

test.afterEach(() => {
  global.fetch = originalFetch;
  global.setTimeout = originalSetTimeout;
});

test('exponentialBackoff returns exponential progression', () => {
  assert.equal(exponentialBackoff(1, 100), 100);
  assert.equal(exponentialBackoff(2, 100), 200);
  assert.equal(exponentialBackoff(3, 100), 400);
});

test('parseRetryAfterToMs handles null, seconds and invalid values', () => {
  assert.equal(parseRetryAfterToMs(null), null);
  assert.equal(parseRetryAfterToMs('5'), 5000);
  assert.equal(parseRetryAfterToMs('invalid'), null);
});

test('delay waits using setTimeout', async () => {
  let called = 0;

  global.setTimeout = ((callback: (...args: unknown[]) => void) => {
    called += 1;
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  await delay(25);

  assert.equal(called, 1);
});

test('callIntegrationWithRetry succeeds on first attempt', async () => {
  let calls = 0;
  global.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const { logger } = createLogger();

  await callIntegrationWithRetry(logger as never, event, '/billing');

  assert.equal(calls, 1);
});

test('callIntegrationWithRetry retries on 500 and then succeeds', async () => {
  let calls = 0;
  global.setTimeout = ((callback: (...args: unknown[]) => void) => {
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  global.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: 'temporary' }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const { logger, warns } = createLogger();

  await callIntegrationWithRetry(logger as never, event, '/billing');

  assert.equal(calls, 2);
  assert.equal(warns.length, 1);
});

test('callIntegrationWithRetry respects Retry-After on 429', async () => {
  let calls = 0;
  const waited: number[] = [];

  global.setTimeout = ((callback: (...args: unknown[]) => void, ms?: number) => {
    waited.push(ms ?? 0);
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  global.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { 'Retry-After': '5' },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const { logger } = createLogger();

  await callIntegrationWithRetry(logger as never, event, '/billing');

  assert.equal(calls, 2);
  assert.equal(waited[0], 5000);
});

test('callIntegrationWithRetry throws non-retryable error on 400', async () => {
  global.fetch = (async () =>
    new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
    })) as typeof fetch;

  const { logger } = createLogger();

  await assert.rejects(
    async () => callIntegrationWithRetry(logger as never, event, '/billing'),
    (error: unknown) => {
      const err = error as { retryable?: boolean; message?: string };
      return err.retryable === false && /non-success status 400/.test(err.message ?? '');
    },
  );
});

test('callIntegrationWithRetry retries network error and exhausts attempts', async () => {
  let calls = 0;
  global.setTimeout = ((callback: (...args: unknown[]) => void) => {
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  global.fetch = (async () => {
    calls += 1;
    throw new Error('network down');
  }) as typeof fetch;

  const { logger, warns } = createLogger();

  await assert.rejects(
    async () => callIntegrationWithRetry(logger as never, event, '/billing'),
    (error: unknown) => {
      const err = error as { retryable?: boolean; message?: string };
      return err.retryable === true && /attempt 4/.test(err.message ?? '');
    },
  );

  assert.equal(calls, 4);
  assert.equal(warns.length, 3);
});
