'use strict';
const config = require('config');
const mqtt = require('mqtt');
const usr = require('../models/user');
const dev = require('../models/device');
const livesvr = require('./liveserver');
const JSONValidator = require('../utils/validator');
const logger = require('../utils/logger');

const MQTTValidator = new JSONValidator('mqtt');

async function processMessage(messageStr) {
    var srcData,
        destData = {};

    // Convert JSON string to object
    // Required: id, apikey, timestamp, lat, lon
    // Optional: tagid, tagapikey, type, attr
    try {
        srcData = JSON.parse(messageStr);
    } catch (e) {
        srcData = null;
    }

    if (srcData !== null) {
        if (!MQTTValidator.validate(srcData)) {
            logger.info('Invalid: ' + MQTTValidator.errorsText());
            // Invalidate MQTT message
            srcData = null;
        }
    }

    if (srcData !== null) {
        if (srcData.apikey && usr.isKnownAPIkey(srcData.apikey, null)) {
            const queryRes = await dev.getDeviceByIdentity(
                srcData.apikey,
                srcData.id
            );
            logger.info('MQTT message: ' + JSON.stringify(srcData));
            if (queryRes.rowCount === 1) {
                const destDevice = queryRes.rows[0];
                destData.device_id = destDevice.device_id;
                destData.api_key = destDevice.api_key;
                destData.identifier = srcData.id;
                destData.device_id_tag = null;
                destData.identifier_tag = null;
                destData.api_key_tag = null;
                destData.alias = destDevice.alias;
                destData.loc_timestamp = srcData.timestamp;
                destData.loc_lat = srcData.lat;
                destData.loc_lon = srcData.lon;
                destData.loc_type = null; // Deprecated for MQTT
                destData.loc_attr = srcData.attr;
                logger.debug('Converted message: ' + JSON.stringify(destData));
                return destData;
            } else {
                logger.debug('Unable to find device');
                return null;
            }
        } else {
            logger.debug('Unknown API key: ' + srcData.apikey);
            return null;
        }
    } else {
        logger.debug('Invalid MQTT message: ' + messageStr);
        return null;
    }
}

//
// Exported modules
//

function start() {
    var client;
    client = mqtt.connect(getBrokerUrl().href, { keepalive: 10 });

    client.on('connect', function () {
        logger.info('Connected to MQTT broker: ' + getBrokerUrl().href);
        client.subscribe(config.get('mqtt.topic'));
        logger.info('MQTT client started');
        // Test
        //var timeStamp = new Date().toISOString();
        //client.publish(config.get('mqtt.topic'), '{"id":"test2", "apikey":"apikey1", "timestamp":"' + timeStamp + '", "lat":"52.123", "lon":"5.123"}');
    });

    client.on('message', async (topic, message) => {
        logger.debug(
            'MQTT message (topic=' + topic + '): ' + message.toString()
        );
        await dev.getAllDevices();
        await usr.getAllUsers();
        const destData = await processMessage(message.toString());
        if (destData !== null) {
            await livesvr.sendToClients(destData);
        }
    });

    client.on('error', function (error) {
        logger.info('MQTT broker error: ' + error);
    });
}

function getBrokerUrl() {
    let brokerUrl = new URL(config.get('mqtt.url'));
    let mqttPort = config.get('mqtt.port');
    let mqttProtocol = config.get('mqtt.protocol');
    let mqttUserVhost = config.get('mqtt.userVhost');

    if (mqttPort !== '') {
        brokerUrl.port = mqttPort;
    }
    if (mqttProtocol !== '') {
        brokerUrl.protocol = mqttProtocol;
    }
    if (mqttUserVhost) {
        brokerUrl.username = `${brokerUrl.username}:${brokerUrl.username}`;
    }
    return brokerUrl;
}

module.exports.start = start;
module.exports.getBrokerUrl = getBrokerUrl;
