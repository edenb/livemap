'use strict';
const config = require('config');
const mqtt = require('../services/mqtt');

exports.getInfo = (req, res) => {
    const info = { ...getApplicationInfo(), ...getMqttInfo() };
    res.status(200).send(info);
};

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
    if (config.get('wclient.showBroker') === 'true') {
        const broker = mqtt.getBrokerUrl();
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
