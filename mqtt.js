"use strict";
var config = require('config');
var mqtt = require('mqtt');
var url = require('url');
var ajv = require('ajv');
var usr = require('./user.js');
var dev = require('./device.js');
var livesvr = require('./liveserver.js');

var client;
var MQTTvalidator = ajv({allErrors: true});

var MQTTschema = {
    "title": "MQTT Schema",
    "type": "object",
    "properties": {
        "id": {
            "description": "The unique identifier for a device",
            "type": "string",
            "minLength": 2,
            "maxLength": 50
        },
        "apikey": {
            "description": "The unique key of the owner of the device",
            "type": "string",
            "minLength": 2,
            "maxLength": 20
        },
        "tagid": {
            "description": "The unique identifier for a tag",
            "type": "string",
            "minLength": 2,
            "maxLength": 50
        },
        "tagapikey": {
            "description": "The unique key of the owner of the tag",
            "type": "string",
            "minLength": 2,
            "maxLength": 20
        },
        "timestamp": {
            "description": "Date and time of the location",
            "type": "string",
            "format": "date-time"
        },
        "lat": {
            "description": "Latitude of the location",
            "type": "number",
            "minimum": -90.0,
            "exclusiveMinimum": true,
            "maximum": 90.0,
            "exclusiveMaximum": true
        },
        "lon": {
            "description": "Longitude of the location",
            "type": "number",
            "minimum": -180.0,
            "exclusiveMinimum": true,
            "maximum": 180.0,
            "exclusiveMaximum": true
        },
        "type": {
            "description": "Type of location",
            "type": "string",
            "enum": ["now", "rec", "left"]
        },
        "attr": {
            "description": "Other attributes",
            "type": "object",
            "properties": {
                "miconname": {
                    "description": "Name of the icon",
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 20
                },
                "miconlib": {
                    "description": "Name of the icon library (glyphicon, fa or ion)",
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 20
                },
                "mcolor": {
                    "description": "Color of the marker",
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 20
                },
                "miconcolor": {
                    "description": "Color of the icon",
                    "type": "string",
                    "minLength": 2,
                    "maxLength": 20
                },
                "mopacity": {
                    "description": "Opacity of the marker",
                    "type": "number",
                    "minimum": 0.0,
                    "exclusiveMinimum": false,
                    "maximum": 1.0,
                    "exclusiveMaximum": false
                }
            }
        }
    },
    "required": ["id", "apikey", "timestamp"]
};

var validate = MQTTvalidator.compile(MQTTschema);

function processMessage(messageStr, callback) {
    var srcData, destData = {};

    // Convert JSON string to object
    // Required: id, apikey, timestamp
    // Optional: lat, lon, tagid, tagapikey, type, attr
    try {
        srcData = JSON.parse(messageStr);
    } catch (e) {
        srcData = null;
    }

    if (srcData !== null) {
        if (validate(srcData)) {
            // For now lat and lon are expected to be strings
            srcData.lon = srcData.lon.toString();
            srcData.lat = srcData.lat.toString();
        } else {
            console.log('Invalid: ' + MQTTvalidator.errorsText(validate.errors));
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
                    destData.loc_type = srcData.type;
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
    var brokerUrl = url.parse(config.get('mqtt.url'));
    client = mqtt.connect(brokerUrl, {keepalive: 10});

    client.on('connect', function () {
        console.log('Connected to MQTT broker: ' + config.get('mqtt.url'));
        client.subscribe(config.get('mqtt.topic'));
        console.log('MQTT client started');
        // Test
        //var timeStamp = new Date().toISOString();
        //client.publish(config.get('mqtt.topic'), '{"id":"test2", "apikey":"apikey1", "timestamp":"' + timeStamp + '", "lat":"52.123", "lon":"5.123"}');
    });

    client.on('message', function (topic, message) {
        console.log('MQTT message (topic=' + topic + '): ' + message.toString());
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

module.exports.start = start;
