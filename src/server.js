import config from 'config';
import App from './app.js';
import { checkDbUp, startMaintenance } from './database/db.js';
import * as liveService from './services/liveserver.js';
import * as mqttService from './services/mqtt.js';
import { processLocation } from './utils/ingester.js';
import Logger from './utils/logger.js';

let mqtt, server;

const logger = Logger(import.meta.url);

export async function allUp(app) {
    const port = config.get('server.port');
    server = app.listen(port, () => {
        logger.info(`Server started on port ${port}`);
    });
    if (await checkDbUp()) {
        startMaintenance();
        liveService.start(server);
        mqtt = mqttService.start(processLocation);

        return server;
    } else {
        logger.info('Waiting for the database...');
        setTimeout(allUp, 5000);
    }
}

export async function allDown() {
    await mqtt.endAsync();
    server.close();
}

if (import.meta.url.endsWith(process.argv[1])) {
    await allUp(App());
}
