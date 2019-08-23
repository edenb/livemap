"use strict";
const qs = require('querystring');
const usr = require('./user.js');
const dev = require('./device.js');
const livesvr = require('./liveserver.js');
const logger = require('./logger.js');

function processGpx(rawLocationData, callback) {
    let srcData = {}, destData = {}, identObj = '';

    if (Object.keys(rawLocationData.query).length !== 0) {
        srcData = rawLocationData.query;
    } else if (rawLocationData.body !== '') {
        srcData = qs.parse(rawLocationData.body);
    }

    identObj = dev.splitDeviceIdentity(srcData.device_id, '_');
    if ((identObj.err === null) && usr.isKnownAPIkey(identObj.apiKey, null)) {
        dev.getDeviceByIdentity(identObj.apiKey, identObj.identifier, (destDevice) => {    // Todo: check device_id existance
            if (destDevice !== null) {
                destData.device_id = destDevice.device_id;
                destData.identifier = destDevice.identifier;
                destData.alias = destDevice.alias;
                destData.device_id_tag = null;
                destData.api_key_tag = null;
                destData.identifier_tag = null;
                destData.loc_timestamp = srcData.gps_time;
                destData.loc_lat = srcData.gps_latitude;
                destData.loc_lon = srcData.gps_longitude;
                destData.loc_type = 'rec';
                destData.loc_attr = null;
            }
            return callback(destData);
        });
    } else {
        return callback(destData);
    }
}

// Locative
// device: uuid of the device Locative is running on (xxxxxxxx-xxxx-xxxx-...)
// id: name of the iBeacon or geofence (should be set in Locative)
// latitude: center of the geofence or zero if iBeacon found
// longitude: center of the geofence or zero if iBeacon found
// timestamp: date/time in seconds after 1970
// trigger: exit, enter or test
// identity geofence - id:device
// identity iBeacon - id1:device  id1:id2
function processLocative(rawLocationData, callback) {
    let srcData = {}, destData = {}, identObj = '', identity = '';

    if (Object.keys(rawLocationData.query).length !== 0) {
        srcData = rawLocationData.query;
    } else if (rawLocationData.body !== '') {
        srcData = qs.parse(rawLocationData.body);
    }

    // Determine if it's a detection of an iBeacon (lon and lat are '0') or the location of a device
    if (srcData.latitude === '0' && srcData.longitude === '0') {
        identObj = dev.splitDeviceIdentity(srcData.id, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            dev.getDeviceByIdentity(identObj.apiKey, srcData.device, (destDevice) => {    // Todo: check device_id existance
                if (destDevice !== null) {
                    destData.device_id = destDevice.device_id;
                    destData.loc_timestamp = new Date(srcData.timestamp * 1000).toUTCString();
                    dev.getDeviceByIdentity(identObj.apiKey, identObj.identifier, (destDevice) => {    // Todo: check id existance
                        if (destDevice !== null) {
                            destData.device_id_tag = destDevice.device_id;
                            destData.alias = destDevice.alias;
                            destData.loc_lat = destDevice.fixed_loc_lat.toString();
                            destData.loc_lon = destDevice.fixed_loc_lon.toString();
                            destData.loc_attr = null;
                            destData.loc_type = null;
                            if ((srcData.trigger === 'enter') || (srcData.trigger === 'test')) {
                                destData.loc_type = 'now';
                            }
                            if (srcData.trigger === 'exit') {
                                destData.loc_type = 'left';
                            }
                            return callback(destData);
                        } else {
                            destData = {};
                            return callback(destData);
                        }
                    });
                } else {
                    return callback(destData);
                }
            });
        } else {
            return callback(destData);
        }
    } else {
        identity = srcData.id + ':' + srcData.device;
        identObj = dev.splitDeviceIdentity(identity, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            dev.getDeviceByIdentity(identObj.apiKey, srcData.device, (destDevice) => {
                if (destDevice !== null) {
                    destData.device_id = destDevice.device_id;
                    destData.device_id_tag = null;
                    destData.alias = destDevice.alias;
                    destData.loc_timestamp = new Date(srcData.timestamp * 1000).toUTCString();
                    destData.loc_lat = srcData.latitude;
                    destData.loc_lon = srcData.longitude;
                    destData.loc_attr = null;
                    destData.loc_type = null;
                    if ((srcData.trigger === 'enter') || (srcData.trigger === 'test')) {
                        destData.loc_type = 'now';
                    }
                    if (srcData.trigger === 'exit') {
                        destData.loc_type = 'left';
                    }
                    return callback(destData);
                } else {
                    return callback(destData);
                }
            });
        } else {
            return callback(destData);
        }
    }
}

//
// Exported modules
//

function processLocation(request, response, type) {
    let rawLocationData = {};
    rawLocationData.body = '';
    rawLocationData.query = request.query;

    request.on('data', (chunk) => {
        rawLocationData.body += chunk.toString();
    });

    request.on('end', () => {
        logger.debug('HTTP ' +  request.method + ' query: ' + qs.stringify(rawLocationData.query));
        logger.debug('HTTP ' +  request.method + ' body: ' + rawLocationData.body);
        dev.loadDevicesFromDB((err) => {
            if (err === null) {
                usr.loadUsersFromDB((err) => {
                    if (err === null) {
                        switch (type) {
                            case 'gpx':
                                processGpx(rawLocationData, (destData) => {
                                    livesvr.sendToClient(destData);
                                });
                                break;
                            case 'locative':
                                processLocative(rawLocationData, (destData) => {
                                    livesvr.sendToClient(destData);
                                });
                                break;
                        }
                    }
                });
            }
        });
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.write('OK');
        response.end();
    });
}

module.exports.processLocation = processLocation;
