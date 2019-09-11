"use strict";
const qs = require('querystring');
const usr = require('./user.js');
const dev = require('./device.js');
const livesvr = require('./liveserver.js');
const logger = require('./logger.js');

async function processGpx(rawLocationData) {
    let srcData = {}, destData = {}, identObj = '';

    if (Object.keys(rawLocationData.query).length !== 0) {
        srcData = rawLocationData.query;
    } else if (rawLocationData.body !== '') {
        srcData = qs.parse(rawLocationData.body);
    }

    identObj = dev.splitDeviceIdentity(srcData.device_id, '_');
    if ((identObj.err === null) && usr.isKnownAPIkey(identObj.apiKey, null)) {
        const queryRes = await dev.getDeviceByIdentity(identObj.apiKey, identObj.identifier);    // Todo: check device_id existance
        if (queryRes.rowCount === 1) {
            const destDevice = queryRes.rows[0];
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
            return destData;
        } else {
            return null;
        }
    } else {
        return null;
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
async function processLocative(rawLocationData) {
    let srcData = {}, destData = {}, identObj = '', identity = '';
    let destDevice;

    if (Object.keys(rawLocationData.query).length !== 0) {
        srcData = rawLocationData.query;
    } else if (rawLocationData.body !== '') {
        srcData = qs.parse(rawLocationData.body);
    }

    // Determine if it's a detection of an iBeacon (lon and lat are '0') or the location of a device
    if (srcData.latitude === '0' && srcData.longitude === '0') {
        identObj = dev.splitDeviceIdentity(srcData.id, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            destDevice = await dev.getDeviceByIdentity(identObj.apiKey, srcData.device);   // Todo: check device_id existance
            if (destDevice !== null) {
                destData.device_id = destDevice.device_id;
                destData.loc_timestamp = new Date(srcData.timestamp * 1000).toUTCString();
                destDevice = await dev.getDeviceByIdentity(identObj.apiKey, identObj.identifier);    // Todo: check id existance
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
                    return destData;
                } else {
                    return null;
                }
        
            } else {
                return null;
            }
        } else {
            return null;
        }
    } else {
        identity = srcData.id + ':' + srcData.device;
        identObj = dev.splitDeviceIdentity(identity, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            destDevice = await dev.getDeviceByIdentity(identObj.apiKey, srcData.device);
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
                return destData;
            } else {
                return null;
            }   
        } else {
            return null;
        }
    }
}

//
// Exported modules
//

async function processLocation(request, response, type) {
    let rawLocationData = {};
    rawLocationData.body = '';
    rawLocationData.query = request.query;

    request.on('data', (chunk) => {
        rawLocationData.body += chunk.toString();
    });

    request.on('end', async () => {
        logger.debug('HTTP ' +  request.method + ' query: ' + qs.stringify(rawLocationData.query));
        logger.debug('HTTP ' +  request.method + ' body: ' + rawLocationData.body);
        await dev.getAllDevices();
        await usr.getAllUsers();

        let destData;
        switch (type) {
            case 'gpx':
                destData = await processGpx(rawLocationData);
                if (destData !== null) {
                    await livesvr.sendToClient(destData);
                }
                response.sendStatus(200);
                break;
            case 'locative':
                destData = await processLocative(rawLocationData);
                if (destData !== null) {
                    await livesvr.sendToClient(destData);
                }
                response.sendStatus(200);
                break;
            default:
                response.sendStatus(404);
        }
    });
}

module.exports.processLocation = processLocation;
