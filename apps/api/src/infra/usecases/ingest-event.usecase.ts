import { EventsRepository } from '../../core/database';
import {
  DuplicateEventError,
  IngestEventUseCaseError,
  InvalidPayloadError,
} from '../../core/errors';
import { validateIncomingEvent } from '../../core/events';
import { IngestEventResponse } from '../../core/interfaces';

export class IngestEventUseCase {
  constructor(private readonly repo: EventsRepository) {}

  async execute(input: unknown): Promise<IngestEventResponse> {
    try {
      const event = this.validateInput(input);
      await this.persistEvent(event);

      return {
        statusCode: 202,
        body: { status: 'accepted' },
        logContext: {
          eventId: event.event_id,
          tenantId: event.tenant_id,
          type: event.type,
        },
      };
    } catch (error) {
      if (error instanceof InvalidPayloadError) {
        return {
          statusCode: 400,
          body: {
            error: 'invalid_payload',
            details: error.details,
          },
        };
      }

      if (error instanceof DuplicateEventError) {
        return {
          statusCode: 409,
          body: {
            error: 'duplicate_event',
            message: 'event_id already exists',
          },
        };
      }

      return {
        statusCode: 500,
        body: { error: 'internal_error' },
      };
    }
  }

  private validateInput(input: unknown) {
    const validation = validateIncomingEvent(input);

    if (!validation.valid || !validation.event) {
      throw new InvalidPayloadError(validation.errors);
    }

    return validation.event;
  }

  private async persistEvent(input: ReturnType<typeof this.validateInput>): Promise<void> {
    try {
      await this.repo.insertEvent(input);
    } catch (error) {
      if (error instanceof InvalidPayloadError || error instanceof DuplicateEventError) {
        throw error;
      }

      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        throw new DuplicateEventError();
      }

      throw new IngestEventUseCaseError({ cause: error });
    }
  }
}
