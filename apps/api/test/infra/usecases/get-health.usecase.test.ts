import assert from 'node:assert/strict';
import test from 'node:test';

import { GetHealthUseCase } from '../../../src/infra/usecases/get-health.usecase';

test('GetHealthUseCase returns ok status', () => {
  const useCase = new GetHealthUseCase();

  const result = useCase.execute();

  assert.deepEqual(result, { status: 'ok' });
});
