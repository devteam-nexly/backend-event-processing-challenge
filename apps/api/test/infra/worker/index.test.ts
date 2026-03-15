import assert from 'node:assert/strict';
import test from 'node:test';

import { startEventWorker } from '../../../src/infra/worker';
import { EventsRepository } from '../../../src/core/database';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createLogger() {
  const warns: Array<{ context: unknown; message: string }> = [];
  const errors: Array<{ context: unknown; message: string }> = [];

  return {
    logger: {
      info: () => undefined,
      warn: (context: unknown, message: string) => warns.push({ context, message }),
      error: (context: unknown, message: string) => errors.push({ context, message }),
    },
    warns,
    errors,
  };
}

test('startEventWorker schedules retry when processing fails and attempts remain', async () => {
  const scheduled: Array<{ retryCount: number; errorMessage: string }> = [];

  const repo = {
    claimPendingEvents: async () => [
      {
        id: 'row-1',
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: 'tenant_a',
        type: 'invalid.type',
        payload: {},
        retryCount: 0,
      },
    ],
    scheduleRetry: async (
      _eventRowId: string,
      retryCount: number,
      _nextAttemptAt: Date,
      errorMessage: string,
    ) => {
      scheduled.push({ retryCount, errorMessage });
    },
    markFailedAndMoveToDlq: async () => {
      throw new Error('should not send to DLQ on first failure');
    },
    markProcessed: async () => undefined,
  } as unknown as EventsRepository;

  const { logger, warns } = createLogger();
  const stop = startEventWorker(repo, logger as never);

  await wait(30);
  stop();

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]?.retryCount, 1);
  assert.equal(scheduled[0]?.errorMessage.length > 0, true);
  assert.equal(warns.length >= 1, true);
});

test('startEventWorker sends event to DLQ when max attempts are reached', async () => {
  const dlq: Array<{ retryCount: number; reason: string }> = [];

  const repo = {
    claimPendingEvents: async () => [
      {
        id: 'row-2',
        eventId: '550e8400-e29b-41d4-a716-446655440001',
        tenantId: 'tenant_a',
        type: 'invalid.type',
        payload: {},
        retryCount: 4,
      },
    ],
    scheduleRetry: async () => {
      throw new Error('should not schedule retry when max attempts are reached');
    },
    markFailedAndMoveToDlq: async (_event: unknown, retryCount: number, reason: string) => {
      dlq.push({ retryCount, reason });
    },
    markProcessed: async () => undefined,
  } as unknown as EventsRepository;

  const { logger } = createLogger();
  const stop = startEventWorker(repo, logger as never);

  await wait(30);
  stop();

  assert.equal(dlq.length, 1);
  assert.equal(dlq[0]?.retryCount, 5);
  assert.equal(dlq[0]?.reason.length > 0, true);
});

test('startEventWorker logs error when claimPendingEvents fails', async () => {
  const repo = {
    claimPendingEvents: async () => {
      throw new Error('db unavailable');
    },
    markProcessed: async () => undefined,
  } as unknown as EventsRepository;

  const { logger, errors } = createLogger();
  const stop = startEventWorker(repo, logger as never);

  await wait(30);
  stop();

  assert.equal(errors.length >= 1, true);
  assert.equal(
    errors.some((entry) => entry.message === 'worker tick failed'),
    true,
  );
});

test('startEventWorker skips overlapping tick when already processing', async () => {
  const originalSetInterval = global.setInterval;

  let claimCalls = 0;
  let releaseClaim!: () => void;
  const claimGate = new Promise<void>((resolve) => {
    releaseClaim = resolve;
  });

  const repo = {
    claimPendingEvents: async () => {
      claimCalls += 1;
      await claimGate;
      return [];
    },
    markProcessed: async () => undefined,
  } as unknown as EventsRepository;

  try {
    global.setInterval = ((callback: (...args: unknown[]) => void) => {
      // Trigger interval callback immediately while initial tick is still processing.
      void callback();
      return 0 as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval;

    const { logger } = createLogger();
    const stop = startEventWorker(repo, logger as never);

    await wait(10);
    releaseClaim();
    await wait(10);
    stop();

    assert.equal(claimCalls, 1);
  } finally {
    global.setInterval = originalSetInterval;
  }
});
