import { eventService } from "./service/worker.service";

async function processEvents() {
    console.log('Worker started');

    while (true) {
        try {
            await eventService.processBatch();
        } catch (err) {
            console.error('Worker error', err);
        }

        await new Promise(r => setTimeout(r, 1000));
    }
}

processEvents();
