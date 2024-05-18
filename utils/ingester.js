import * as usr from '../models/user.js';
import * as dev from '../models/device.js';
import { sendToClients } from '../services/liveserver.js';
import Logger from '../utils/logger.js';
import JSONValidator from '../utils/validator.js';

const logger = Logger(import.meta.url);
const MQTTValidator = new JSONValidator('mqtt');

async function processGpx(payload) {
    let destData = {},
        identObj = '';

    identObj = dev.splitDeviceIdentity(payload.device_id, '_');
    if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
        const queryRes = await dev.getDeviceByIdentity(
            identObj.apiKey,
            identObj.identifier,
        ); // Todo: check device_id existance
        if (queryRes.rowCount === 1) {
            const destDevice = queryRes.rows[0];
            destData.device_id = destDevice.device_id;
            destData.api_key = destDevice.api_key;
            destData.identifier = destDevice.identifier;
            destData.alias = destDevice.alias;
            destData.device_id_tag = null;
            destData.api_key_tag = null;
            destData.identifier_tag = null;
            destData.loc_timestamp = payload.gps_time;
            destData.loc_lat = parseFloat(payload.gps_latitude);
            destData.loc_lon = parseFloat(payload.gps_longitude);
            destData.loc_type = 'rec';
            destData.loc_attr = null;
            return destData;
        } else {
            throw new Error('No device found.');
        }
    } else {
        throw new Error('No API key and/or identity found.');
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
async function processLocative(payload) {
    let destData = {},
        identObj = '',
        identity = '';

    // Determine if it's a detection of an iBeacon (lon and lat are '0') or the location of a device
    if (payload.latitude === '0' && payload.longitude === '0') {
        identObj = dev.splitDeviceIdentity(payload.id, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            let queryRes = await dev.getDeviceByIdentity(
                identObj.apiKey,
                payload.device,
            ); // Todo: check device_id existance
            if (queryRes.rowCount === 1) {
                let destDevice = queryRes.rows[0];
                destData.device_id = destDevice.device_id;
                destData.loc_timestamp = new Date(
                    payload.timestamp * 1000,
                ).toISOString();
                queryRes = await dev.getDeviceByIdentity(
                    identObj.apiKey,
                    identObj.identifier,
                ); // Todo: check id existance
                if (queryRes.rowCount === 1) {
                    destDevice = queryRes.rows[0];
                    destData.device_id_tag = destDevice.device_id;
                    destData.api_key = destDevice.api_key;
                    destData.alias = destDevice.alias;
                    destData.loc_lat = destDevice.fixed_loc_lat;
                    destData.loc_lon = destDevice.fixed_loc_lon;
                    destData.loc_attr = null;
                    destData.loc_type = null;
                    if (
                        payload.trigger === 'enter' ||
                        payload.trigger === 'test'
                    ) {
                        destData.loc_type = 'now';
                    }
                    if (payload.trigger === 'exit') {
                        destData.loc_type = 'left';
                    }
                    return destData;
                } else {
                    throw new Error('No device found.');
                }
            } else {
                throw new Error('No device found.');
            }
        } else {
            throw new Error('No API key and/or identity found.');
        }
    } else {
        identity = payload.id + ':' + payload.device;
        identObj = dev.splitDeviceIdentity(identity, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            const queryRes = await dev.getDeviceByIdentity(
                identObj.apiKey,
                payload.device,
            );
            if (queryRes.rowCount === 1) {
                const destDevice = queryRes.rows[0];
                destData.device_id = destDevice.device_id;
                destData.api_key = destDevice.api_key;
                destData.device_id_tag = null;
                destData.alias = destDevice.alias;
                destData.loc_timestamp = new Date(
                    payload.timestamp * 1000,
                ).toISOString();
                destData.loc_lat = parseFloat(payload.latitude);
                destData.loc_lon = parseFloat(payload.longitude);
                destData.loc_attr = null;
                destData.loc_type = null;
                if (payload.trigger === 'enter' || payload.trigger === 'test') {
                    destData.loc_type = 'now';
                }
                if (payload.trigger === 'exit') {
                    destData.loc_type = 'left';
                }
                return destData;
            } else {
                throw new Error('No device found.');
            }
        } else {
            throw new Error('No API key and/or identity found.');
        }
    }
}

async function processMqtt(payload) {
    var srcData,
        destData = {};

    // Convert JSON string to object
    // Required: id, apikey, timestamp, lat, lon
    // Optional: tagid, tagapikey, type, attr
    try {
        srcData = JSON.parse(payload);
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
                srcData.id,
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
        logger.debug('Invalid MQTT message: ' + payload);
        return null;
    }
}

//
// Exported modules
//

export async function processLocation(format, payload) {
    // Retrieve latest information about users and devices
    await dev.getAllDevices();
    await usr.getAllUsers();

    let destData = null;
    switch (format) {
        case 'gpx':
            destData = await processGpx(payload);
            break;
        case 'locative':
            destData = await processLocative(payload);
            break;
        case 'mqtt':
            destData = await processMqtt(payload);
            break;
    }
    if (destData) {
        sendToClients(destData);
    }
    return destData;
}
