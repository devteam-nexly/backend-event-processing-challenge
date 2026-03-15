import assert from 'node:assert/strict';
import test from 'node:test';

import { processEvent } from '../../../src/infra/worker/processor';
import { EventsRepository } from '../../../src/core/database';

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
});

function createLogger() {
  const infos: Array<{ context: unknown; message: string }> = [];

  return {
    logger: {
      info: (context: unknown, message: string) => infos.push({ context, message }),
      warn: () => undefined,
      error: () => undefined,
    },
    infos,
  };
}

test('processEvent calls integrations and marks event as processed', async () => {
  let calls = 0;
  global.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  let processedEventId: string | null = null;
  const repo = {
    markProcessed: async (eventRowId: string) => {
      processedEventId = eventRowId;
    },
  } as unknown as EventsRepository;

  const event = {
    id: 'row-1',
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: 'tenant_a',
    type: 'order.created' as const,
    payload: { orderId: 'ORD-1' },
    retryCount: 0,
  };

  const { logger, infos } = createLogger();

  await processEvent(repo, logger as never, event);

  assert.equal(calls, 2);
  assert.equal(processedEventId, 'row-1');
  assert.equal(infos.length, 2);
});

test('processEvent propagates integration failure and does not mark processed', async () => {
  global.fetch = (async () =>
    new Response(JSON.stringify({ error: 'bad' }), { status: 400 })) as typeof fetch;

  let markProcessedCalls = 0;
  const repo = {
    markProcessed: async () => {
      markProcessedCalls += 1;
    },
  } as unknown as EventsRepository;

  const event = {
    id: 'row-2',
    eventId: '550e8400-e29b-41d4-a716-446655440001',
    tenantId: 'tenant_a',
    type: 'payment.approved' as const,
    payload: { paymentId: 'PAY-1' },
    retryCount: 0,
  };

  const { logger } = createLogger();

  await assert.rejects(async () => processEvent(repo, logger as never, event));
  assert.equal(markProcessedCalls, 0);
});
