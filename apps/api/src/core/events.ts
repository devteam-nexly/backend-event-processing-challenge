import {
  ACCEPTED_EVENT_TYPES,
  AcceptedEventType,
  IncomingEvent,
  PersistedEvent,
} from './interfaces';

export { ACCEPTED_EVENT_TYPES, AcceptedEventType, IncomingEvent, PersistedEvent };

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAcceptedEventType(value: string): value is AcceptedEventType {
  return ACCEPTED_EVENT_TYPES.includes(value as AcceptedEventType);
}

export function validateIncomingEvent(input: unknown): {
  valid: boolean;
  errors: string[];
  event?: IncomingEvent;
} {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, errors: ['body must be a JSON object'] };
  }

  const candidate = input as Record<string, unknown>;

  const eventId = candidate.event_id;
  if (typeof eventId !== 'string' || !UUID_V4_REGEX.test(eventId)) {
    errors.push('event_id must be a valid UUID v4 string');
  }

  const tenantId = candidate.tenant_id;
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    errors.push('tenant_id must be a non-empty string');
  }

  const type = candidate.type;
  if (typeof type !== 'string' || !isAcceptedEventType(type)) {
    errors.push('type must be one of the accepted event types');
  }

  const payload = candidate.payload;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    errors.push('payload must be a JSON object');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors,
    event: {
      event_id: eventId as string,
      tenant_id: (tenantId as string).trim(),
      type: type as AcceptedEventType,
      payload: payload as Record<string, unknown>,
    },
  };
}
