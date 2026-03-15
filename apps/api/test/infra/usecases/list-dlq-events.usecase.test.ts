import assert from 'node:assert/strict';
import test from 'node:test';

import { ListDlqEventsUseCase } from '../../../src/infra/usecases/list-dlq-events.usecase';
import { ListDlqEventsUseCaseError } from '../../../src/core/errors';
import { EventsRepository } from '../../../src/core/database';

test('ListDlqEventsUseCase returns DLQ events from repository', async () => {
  const expected = [
    {
      id: 1,
      event_id: '550e8400-e29b-41d4-a716-446655440000',
      tenant_id: 'tenant_a',
      type: 'order.created',
      payload: { orderId: 'ORD-1' },
      retry_count: 5,
      failure_reason: 'integration failed',
      created_at: '2026-03-15T10:00:00.000Z',
    },
  ];

  const repo = {
    listDlqEvents: async () => expected,
  } as unknown as EventsRepository;

  const useCase = new ListDlqEventsUseCase(repo);
  const result = await useCase.execute();

  assert.deepEqual(result, expected);
});

test('ListDlqEventsUseCase maps repository error to ListDlqEventsUseCaseError', async () => {
  const repo = {
    listDlqEvents: async () => {
      throw new Error('repository unavailable');
    },
  } as unknown as EventsRepository;

  const useCase = new ListDlqEventsUseCase(repo);

  await assert.rejects(
    async () => useCase.execute(),
    (error: unknown) =>
      error instanceof ListDlqEventsUseCaseError &&
      error.code === 'dlq_list_failed' &&
      error.message === 'failed_to_list_dlq_events',
  );
});
