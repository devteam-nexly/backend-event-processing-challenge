import { AcceptedEventType } from './accepted-event-type';

export interface PersistedEvent {
  id: string;
  eventId: string;
  tenantId: string;
  type: AcceptedEventType;
  payload: Record<string, unknown>;
  retryCount: number;
}
