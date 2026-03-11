import axios from 'axios';
import { eventRepository } from '../repository/worker.repository';

const BASE_URL = process.env.MOCK_INTEGRATIONS_URL;

export const eventService = {
    async processBatch() {
        const events = await eventRepository.fetchPending(10);

        for (const event of events) {
            try {
                await this.processEvent(event);
                await eventRepository.markProcessed(event.id);
                console.log(`Event ${event.id} processed successfully`);
            } catch (err: any) {
                console.error('Processing failed', err);
                if (event.retry_count + 1 >= event.max_retries) {
                    console.error(`Event ${event.id} has reached max retries. Marking as failed.`);
                    await eventRepository.moveToDLQ(event, err);
                } else {
                    console.error(`Event ${event.id} will be retried in ${event.next_retry_at}`);
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
