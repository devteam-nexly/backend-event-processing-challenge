import { GetHealthUseCaseError } from '../../core/errors';

export class GetHealthUseCase {
  execute(): { status: 'ok' } {
    try {
      return { status: 'ok' };
    } catch (error) {
      throw new GetHealthUseCaseError({ cause: error });
    }
  }
}
