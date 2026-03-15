export const ACCEPTED_EVENT_TYPES = [
  'order.created',
  'order.updated',
  'order.cancelled',
  'payment.approved',
  'payment.refused',
  'customer.registered',
  'customer.updated',
] as const;

export type AcceptedEventType = (typeof ACCEPTED_EVENT_TYPES)[number];
