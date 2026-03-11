import 'dotenv/config';
import { EventsRepository } from './events.repository';
import { EventBody } from "./events.schema";

export class EventsService {
    private eventsRepository: EventsRepository = new EventsRepository();

    async createEvent(data: EventBody): Promise<void> {
        this.eventsRepository.createEvent(data);
        return;
    }

    async getDlqEvents(): Promise<any[]> {
        const result = await this.eventsRepository.getDlqEvents();
        return result.rows;
    }

    async getMetrics(): Promise<any> {
        const result = await this.eventsRepository.getMetrics();
        return result.rows;
    }
}
