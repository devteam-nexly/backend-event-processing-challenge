import assert from 'node:assert/strict';
import test from 'node:test';

import { DuplicateEventError, InvalidPayloadError } from '../../../src/core/errors';
import { EventsRepository } from '../../../src/core/database';
import { IngestEventUseCase } from '../../../src/infra/usecases/ingest-event.usecase';

const validEvent = {
  event_id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: 'tenant_a',
  type: 'order.created' as const,
  payload: { orderId: 'ORD-1' },
};

test('IngestEventUseCase returns 202 and log context for valid event', async () => {
  let persisted = 0;
  const repo = {
    insertEvent: async () => {
      persisted += 1;
    },
  } as unknown as EventsRepository;
  const useCase = new IngestEventUseCase(repo);
  const result = await useCase.execute(validEvent);

  assert.equal(result.statusCode, 202);
  assert.deepEqual(result.body, { status: 'accepted' });
  assert.deepEqual(result.logContext, {
    eventId: validEvent.event_id,
    tenantId: validEvent.tenant_id,
    type: validEvent.type,
  });
  assert.equal(persisted, 1);
});

test('IngestEventUseCase returns 400 for invalid payload', async () => {
  const repo = {
    insertEvent: async () => {
      throw new Error('insertEvent should not be called for invalid payload');
    },
  } as unknown as EventsRepository;

  const useCase = new IngestEventUseCase(repo);
  const result = await useCase.execute({ event_id: 'bad' });

  assert.equal(result.statusCode, 400);
  const body = result.body as { error: string };
  assert.equal(body.error, 'invalid_payload');
});

test('IngestEventUseCase maps pg unique violation to 409 duplicate_event', async () => {
  const repo = {
    insertEvent: async () => {
      const err = new Error('duplicate key value violates unique constraint') as Error & {
        code?: string;
      };
      err.code = '23505';
      throw err;
    },
  } as unknown as EventsRepository;

  const useCase = new IngestEventUseCase(repo);
  const result = await useCase.execute(validEvent);

  assert.equal(result.statusCode, 409);
  const body = result.body as { error: string; message: string };
  assert.equal(body.error, 'duplicate_event');
  assert.equal(body.message, 'event_id already exists');
});

test('IngestEventUseCase returns 500 for unexpected repository error', async () => {
  let called = 0;
  const repo = {
    insertEvent: async () => {
      called += 1;
      throw new Error('db offline');
    },
  } as unknown as EventsRepository;
  const useCase = new IngestEventUseCase(repo);
  const result = await useCase.execute(validEvent);

  assert.equal(called, 1);
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: 'internal_error' });
});

test('IngestEventUseCase maps DuplicateEventError to 409', async () => {
  const repo = {
    insertEvent: async () => {
      throw new DuplicateEventError();
    },
  } as unknown as EventsRepository;

  const useCase = new IngestEventUseCase(repo);
  const result = await useCase.execute(validEvent);

  assert.equal(result.statusCode, 409);
  assert.deepEqual(result.body, {
    error: 'duplicate_event',
    message: 'event_id already exists',
  });
});

test('IngestEventUseCase maps InvalidPayloadError thrown by repository to 400', async () => {
  const repo = {
    insertEvent: async () => {
      throw new InvalidPayloadError(['payload must be a JSON object']);
    },
  } as unknown as EventsRepository;

  const useCase = new IngestEventUseCase(repo);
  const result = await useCase.execute(validEvent);

  assert.equal(result.statusCode, 400);
  assert.deepEqual(result.body, {
    error: 'invalid_payload',
    details: ['payload must be a JSON object'],
  });
});
