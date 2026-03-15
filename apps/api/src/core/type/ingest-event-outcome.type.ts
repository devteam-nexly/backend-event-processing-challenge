import { IncomingEvent } from '../interfaces';

export type IngestEventOutcome =
  | {
      kind: 'accepted';
      event: IncomingEvent;
    }
  | {
      kind: 'invalid_payload';
      details: string[];
    }
  | {
      kind: 'duplicate_event';
    }
  | {
      kind: 'internal_error';
    };
