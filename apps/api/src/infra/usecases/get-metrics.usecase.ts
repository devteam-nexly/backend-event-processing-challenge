import { EventsRepository } from '../../core/database';
import { GetMetricsUseCaseError } from '../../core/errors';

export interface EventMetrics {
  processed: number;
  failed: number;
  dlq: number;
  pending: number;
}

export class GetMetricsUseCase {
  constructor(private readonly repo: EventsRepository) {}

  async execute(): Promise<EventMetrics> {
    try {
      return await this.repo.getMetrics();
    } catch (error) {
      throw new GetMetricsUseCaseError({ cause: error });
    }
  }
}
