import { IncomingEvent } from './incoming-event';

export interface IngestEventResponse {
  statusCode: 202 | 400 | 409 | 500;
  body:
    | { status: 'accepted' }
    | { error: 'invalid_payload'; details: string[] }
    | { error: 'duplicate_event'; message: 'event_id already exists' }
    | { error: 'internal_error' };
  logContext?: {
    eventId: string;
    tenantId: string;
    type: IncomingEvent['type'];
  };
}
