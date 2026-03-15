import { AcceptedEventType } from './accepted-event-type';

export interface IncomingEvent {
  event_id: string;
  tenant_id: string;
  type: AcceptedEventType;
  payload: Record<string, unknown>;
}
