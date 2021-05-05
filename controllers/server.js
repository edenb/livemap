'use strict';
const config = require('config');
const mqtt = require('../services/mqtt');

exports.getInfo = (req, res) => {
    const info = { application: getApplicationInfo(), mqtt: getMqttInfo() };
    res.status(200).send(info);
};

function getApplicationInfo() {
    return {
        name: config.get('wclient.name'),
        about: config.get('wclient.about'),
        license: config.get('wclient.license'),
    };
}

function getMqttInfo() {
    const broker = mqtt.getBrokerUrl();
    return {
        url: `${broker.protocol}//${broker.hostname}`,
        port: `${broker.port}`,
    };
}
