import { EventsRepository } from '../../core/database';
import { ListDlqEventsUseCaseError } from '../../core/errors';
import { DlqEvent } from '../../core/interfaces';

export class ListDlqEventsUseCase {
  constructor(private readonly repo: EventsRepository) {}

  async execute(): Promise<DlqEvent[]> {
    try {
      return await this.repo.listDlqEvents();
    } catch (error) {
      throw new ListDlqEventsUseCaseError({ cause: error });
    }
  }
}
