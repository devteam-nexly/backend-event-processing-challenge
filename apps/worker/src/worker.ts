import { logger } from "./logger";
import { eventService } from "./service/worker.service";

async function processEvents() {
    logger.info('Worker started');

    while (true) {
        try {
            await eventService.processBatch();
        } catch (err: any) {
            logger.error({ action: 'process_batch_failed', message: err.message });
        }

        await new Promise(r => setTimeout(r, 1000));
    }
}

processEvents();
