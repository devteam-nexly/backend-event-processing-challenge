import { Static, Type } from '@sinclair/typebox';

export const EventBodySchema = Type.Object({
    event_id: Type.String({ format: 'uuid' }),
    tenant_id: Type.String(),
    type: Type.String(),
    payload: Type.Object({}, { additionalProperties: true }),
});

export type EventBody = Static<typeof EventBodySchema>;
