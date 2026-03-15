import assert from 'node:assert/strict';
import test from 'node:test';

import { GetMetricsUseCase } from '../../../src/infra/usecases/get-metrics.usecase';
import { GetMetricsUseCaseError } from '../../../src/core/errors';
import { EventsRepository } from '../../../src/core/database';

test('GetMetricsUseCase returns metrics from repository', async () => {
  const expected = {
    processed: 10,
    failed: 2,
    dlq: 2,
    pending: 5,
  };

  const repo = {
    getMetrics: async () => expected,
  } as unknown as EventsRepository;

  const useCase = new GetMetricsUseCase(repo);
  const result = await useCase.execute();

  assert.deepEqual(result, expected);
});

test('GetMetricsUseCase maps repository error to GetMetricsUseCaseError', async () => {
  const repo = {
    getMetrics: async () => {
      throw new Error('repository unavailable');
    },
  } as unknown as EventsRepository;

  const useCase = new GetMetricsUseCase(repo);

  await assert.rejects(
    async () => useCase.execute(),
    (error: unknown) =>
      error instanceof GetMetricsUseCaseError &&
      error.code === 'metrics_fetch_failed' &&
      error.message === 'failed_to_get_metrics',
  );
});
