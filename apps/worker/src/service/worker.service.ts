import axios from 'axios';
import { logger } from '../logger';
import { eventRepository } from '../repository/worker.repository';

const BASE_URL = process.env.MOCK_INTEGRATIONS_URL;

export const eventService = {
    async processBatch() {
        const events = await eventRepository.fetchPending(10);

        for (const event of events) {
            try {
                await this.processEvent(event);
                await eventRepository.markProcessed(event.id);
                logger.info({ event_id: event.id, action: 'processed' });
            } catch (err: any) {
                if (err.response?.status === 429) {
                    const retryAfter = parseInt(err.response?.headers?.['retry-after'] ?? '60', 10);

                    logger.warn({ event_id: event.id, action: 'rate_limit', retry_after: retryAfter, message: err.message });

                    event.retry_at = new Date(Date.now() + retryAfter * 1000);
                    await eventRepository.markFailedWithRetry(event.id, err?.message || 'Rate limited', event.retry_at);
                } else if (event.retry_count + 1 >= event.max_retries) {
                    logger.error({ event_id: event.id, action: 'move_to_dlq' });
                    await eventRepository.moveToDLQ(event, err);
                } else {
                    logger.warn({ event_id: event.id, action: 'mark_failed', retry_count: event.retry_count + 1, message: err.message });
                    await eventRepository.markFailed(event.id, err?.message || 'Unknown error');
                }
            }
        }
    },

    async processEvent(event: any) {
        const type = event.type;

        if (type.startsWith('order.')) {
            await axios.post(`${BASE_URL}/billing`, event.payload);
            await axios.post(`${BASE_URL}/crm`, event.payload);
        }

        if (type.startsWith('payment.')) {
            await axios.post(`${BASE_URL}/billing`, event.payload);
        }

        if (type.startsWith('customer.')) {
            await axios.post(`${BASE_URL}/crm`, event.payload);
            await axios.post(`${BASE_URL}/notifications`, event.payload);
        }
    }
};
