import config from 'config';
import { connect } from 'mqtt';
import Logger from '../utils/logger.js';

//
// Exported modules
//

export function start(onLocation) {
    const logger = Logger(import.meta.url);
    logger.info('Try connect to MQTT broker: ' + getBrokerUrl().href);
    const client = connect(getBrokerUrl().href, { keepalive: 10 });

    client.on('connect', async () => {
        logger.info('Connected to MQTT broker: ' + getBrokerUrl().href);
        await client.subscribeAsync(config.get('mqtt.topic'));
        logger.info('MQTT client started');
    });

    client.on('message', (_topic, message, _packet) => {
        onLocation(logger, 'mqtt', message.toString());
    });

    client.on('error', (error) => {
        logger.info('MQTT broker error: ' + error);
    });

    return client;
}

export function getBrokerUrl() {
    let brokerUrl = new URL(config.get('mqtt.url'));
    let mqttPort = config.get('mqtt.port');
    let mqttProtocol = config.get('mqtt.protocol');
    let mqttUserVhost = config.get('mqtt.userVhost');

    if (mqttPort) {
        brokerUrl.port = mqttPort;
    }
    if (mqttProtocol) {
        brokerUrl.protocol = mqttProtocol;
    }
    if (mqttUserVhost) {
        brokerUrl.username = `${brokerUrl.username}:${brokerUrl.username}`;
    }
    return brokerUrl;
}
