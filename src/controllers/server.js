import config from 'config';
import { getBrokerUrl } from '../services/mqtt.js';

export function getInfo(req, res) {
    const info = { ...getApplicationInfo(), ...getMqttInfo() };
    res.status(200).send(info);
}

function getApplicationInfo() {
    const applicationInfo = {
        application: {
            name: config.get('wclient.name'),
            about: config.get('wclient.about'),
            license: config.get('wclient.license'),
        },
    };
    return applicationInfo;
}

function getMqttInfo() {
    if (config.get('wclient.showBroker')) {
        const broker = getBrokerUrl();
        const mqttInfo = {
            mqtt: {
                url: `${broker.protocol}//${broker.hostname}`,
                port: `${broker.port}`,
            },
        };
        return mqttInfo;
    } else {
        return {};
    }
}
