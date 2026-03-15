import assert from 'node:assert/strict';
import test from 'node:test';

import { isAcceptedEventType, validateIncomingEvent } from '../../src/core/events';

test('isAcceptedEventType returns true for accepted types', () => {
  assert.equal(isAcceptedEventType('order.created'), true);
  assert.equal(isAcceptedEventType('customer.updated'), true);
});

test('isAcceptedEventType returns false for unknown types', () => {
  assert.equal(isAcceptedEventType('order.unknown'), false);
});

test('validateIncomingEvent accepts a valid payload and trims tenant_id', () => {
  const input = {
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: '  tenant_a  ',
    type: 'order.created',
    payload: { orderId: 'ORD-1' },
  };

  const result = validateIncomingEvent(input);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.event, {
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: 'tenant_a',
    type: 'order.created',
    payload: { orderId: 'ORD-1' },
  });
});

test('validateIncomingEvent rejects non-object body', () => {
  const result = validateIncomingEvent(null);

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['body must be a JSON object']);
});

test('validateIncomingEvent rejects array body', () => {
  const result = validateIncomingEvent([]);

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['body must be a JSON object']);
});

test('validateIncomingEvent returns all validation errors for invalid payload', () => {
  const result = validateIncomingEvent({
    event_id: 'not-a-uuid',
    tenant_id: ' ',
    type: 'invalid.type',
    payload: [],
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    'event_id must be a valid UUID v4 string',
    'tenant_id must be a non-empty string',
    'type must be one of the accepted event types',
    'payload must be a JSON object',
  ]);
});

test('validateIncomingEvent rejects wrong primitive types for core fields', () => {
  const result = validateIncomingEvent({
    event_id: 123,
    tenant_id: 456,
    type: 789,
    payload: 'invalid',
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    'event_id must be a valid UUID v4 string',
    'tenant_id must be a non-empty string',
    'type must be one of the accepted event types',
    'payload must be a JSON object',
  ]);
});

test('validateIncomingEvent rejects null payload explicitly', () => {
  const result = validateIncomingEvent({
    event_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: 'tenant_a',
    type: 'order.created',
    payload: null,
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['payload must be a JSON object']);
});
