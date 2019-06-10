"use strict";
var config = require('config');
var mqtt = require('mqtt');
var usr = require('./user.js');
var dev = require('./device.js');
var livesvr = require('./liveserver.js');
var JSONValidator = require('./validator.js');

var MQTTvalidator = new JSONValidator('mqtt');

function processMessage(messageStr, callback) {
    var srcData, destData = {};

    // Convert JSON string to object
    // Required: id, apikey, timestamp, lat, lon
    // Optional: tagid, tagapikey, type, attr
    try {
        srcData = JSON.parse(messageStr);
    } catch (e) {
        srcData = null;
    }

    if (srcData !== null) {
        if (MQTTvalidator.validate(srcData)) {
            // For now lat and lon are expected to be strings
            srcData.lon = srcData.lon.toString();
            srcData.lat = srcData.lat.toString();
        } else {
            console.log('Invalid: ' + MQTTvalidator.errorsText());
            // Invalidate MQTT message
            srcData = null;
        }
    }

    if (srcData !== null) {
        if (srcData.apikey && usr.isKnownAPIkey(srcData.apikey, null)) {
            dev.getDeviceByIdentity(srcData.apikey, srcData.id, function (destDevice) {
                //console.log('MQTT message: ' + JSON.stringify(srcData));
                if (destDevice !== null) {
                    destData.device_id = destDevice.device_id;
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
                    //console.log('Converted message: ' + JSON.stringify(destData));
                    return callback(destData);
                } else {
                    //console.log('Unable to find device');
                    return callback(null);
                }
            });
        } else {
            //console.log('Unknown API key: ' + srcData.apikey);
            return callback(null);
        }
    } else {
        //console.log('Invalid MQTT message: ' + messageStr);
        return callback(null);
    }
}

//
// Exported modules
//

function start() {
    var client;
    client = mqtt.connect(getBrokerUrl().href, {keepalive: 10});

    client.on('connect', function () {
        console.log('Connected to MQTT broker: ' + getBrokerUrl().href);
        client.subscribe(config.get('mqtt.topic'));
        console.log('MQTT client started');
        // Test
        //var timeStamp = new Date().toISOString();
        //client.publish(config.get('mqtt.topic'), '{"id":"test2", "apikey":"apikey1", "timestamp":"' + timeStamp + '", "lat":"52.123", "lon":"5.123"}');
    });

    client.on('message', function (topic, message) {
        //console.log('MQTT message (topic=' + topic + '): ' + message.toString());
        dev.loadDevicesFromDB(function (err) {
            if (err === null) {
                usr.loadUsersFromDB(function (err) {
                    if (err === null) {
                        processMessage(message.toString(), function (destData) {
                            if (destData !== null) {
                                livesvr.sendToClient(destData);
                            }
                        });
                    }
                });
            }
        });
    });

    client.on('error', function (error) {
        console.log('MQTT broker error: ' + error);
    });
}

function getBrokerUrl() {
    return new URL(config.get('mqtt.url'));
}

module.exports.start = start;
module.exports.getBrokerUrl = getBrokerUrl;