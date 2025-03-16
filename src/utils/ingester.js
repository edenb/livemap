import * as dev from '../models/device.js';
import * as pos from '../models/position.js';
import * as usr from '../models/user.js';
import { sendToClients } from '../services/liveserver.js';
import Validator from './validator.js';

let livemapValidator;
let MQTTValidator;

async function processGpx(payload) {
    const { apiKey, identifier } = dev.splitDeviceIdentity(
        payload.device_id,
        '_',
    );
    if (!(await usr.isKnownAPIkey(apiKey, null))) {
        throw new Error('No API key found');
    }
    let device = await dev.getDeviceByIdentity(apiKey, identifier);
    // If the device does not exist create a new one
    if (!device) {
        const newDevice = {
            api_key: apiKey,
            identifier: identifier,
            alias: identifier,
        };
        const { rows: devices } = await dev.addDevice(newDevice);
        device = devices[0];
    }
    let destData = {};
    destData.alias = device.alias;
    destData.api_key = device.api_key;
    destData.api_key_tag = null;
    destData.device_id = device.device_id;
    destData.device_id_tag = null;
    destData.identifier = device.identifier;
    destData.identifier_tag = null;
    destData.loc_attr = null;
    destData.loc_lat = parseFloat(payload.gps_latitude);
    destData.loc_lon = parseFloat(payload.gps_longitude);
    destData.loc_timestamp = payload.gps_time;
    destData.loc_type = 'rec';
    return destData;
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
    let device, tag;

    // If it's a detection of an iBeacon tag (lon and lat are '0')
    if (payload.latitude === '0' && payload.longitude === '0') {
        const { apiKey, identifier } = dev.splitDeviceIdentity(payload.id, ':');
        if (!(await usr.isKnownAPIkey(apiKey, null))) {
            throw new Error('No API key found');
        }
        tag = await dev.getDeviceByIdentity(apiKey, identifier);
        // If the tag does not exist create a new one
        if (!tag) {
            const newTag = {
                api_key: apiKey,
                identifier: identifier,
                alias: identifier,
            };
            const { rows: tags } = await dev.addDevice(newTag);
            tag = tags[0];
        }
    }

    if (!tag && !(await usr.isKnownAPIkey(payload.id, null))) {
        throw new Error('No API key found');
    }
    device = await dev.getDeviceByIdentity(
        tag?.api_key || payload.id,
        payload.device,
    );
    // If the device does not exist create a new one
    if (!device) {
        const newDevice = {
            api_key: tag?.api_key || payload.id,
            identifier: payload.device,
            alias: payload.device,
        };
        const { rows: devices } = await dev.addDevice(newDevice);
        device = devices[0];
    }
    let destData = {};
    destData.alias = device.alias;
    destData.api_key = tag?.api_key || payload.id;
    destData.api_key_tag = tag?.api_key || null;
    destData.device_id = device.device_id;
    destData.device_id_tag = tag?.device_id || null;
    destData.identifier = device.identifier;
    destData.identifier_tag = tag?.identifier || null;
    destData.loc_attr = null;
    destData.loc_lat =
        tag?.fixed_loc_lat || parseFloat(payload.latitude) || null;
    destData.loc_lon =
        tag?.fixed_loc_lon || parseFloat(payload.longitude) || null;
    destData.loc_timestamp = new Date(payload.timestamp * 1000).toISOString();
    destData.loc_type = null;
    if (payload.trigger === 'enter' || payload.trigger === 'test') {
        destData.loc_type = 'now';
    }
    if (payload.trigger === 'exit') {
        destData.loc_type = 'left';
    }
    return destData;
}

async function processMqtt(payload, validator) {
    let srcData;
    try {
        srcData = JSON.parse(payload);
    } catch (err) {
        throw new Error(`Unable to parse payload. ${err.message}`);
    }

    if (validator) {
        if (!validator.validate(srcData)) {
            throw new Error(`Invalid message: ${validator.errorsText()}`);
        }
    }

    if (!(await usr.isKnownAPIkey(srcData.apikey, null))) {
        throw new Error('No API key found');
    }
    let device = await dev.getDeviceByIdentity(srcData.apikey, srcData.id);
    // If the device does not exist create a new one
    if (!device) {
        const newDevice = {
            api_key: srcData.apikey,
            identifier: srcData.id,
            alias: srcData.id,
        };
        const { rows: devices } = await dev.addDevice(newDevice);
        device = devices[0];
    }
    let destData = {};
    destData.alias = device.alias;
    destData.api_key = device.api_key;
    destData.api_key_tag = null;
    destData.device_id = device.device_id;
    destData.device_id_tag = null;
    destData.identifier = srcData.id;
    destData.identifier_tag = null;
    destData.loc_attr = srcData.attr;
    destData.loc_lat = srcData.lat;
    destData.loc_lon = srcData.lon;
    destData.loc_timestamp = srcData.timestamp;
    destData.loc_type = null; // Deprecated for MQTT
    return destData;
}

//
// Exported modules
//

export async function processLocation(parentLogger, format, payload) {
    const logger = parentLogger?.child({ fileUrl: import.meta.url });

    livemapValidator ||= new Validator(logger, 'livemap');
    MQTTValidator ||= new Validator(logger, 'mqtt');

    let destData = null;
    try {
        switch (format) {
            case 'gpx':
                destData = await processGpx(payload);
                break;
            case 'locative':
                destData = await processLocative(payload);
                break;
            case 'mqtt':
                destData = await processMqtt(payload, MQTTValidator);
                break;
        }

        if (destData) {
            if (livemapValidator.validate(destData)) {
                await Promise.all([
                    pos.insertPosition([
                        destData.device_id,
                        destData.device_id_tag,
                        destData.loc_timestamp,
                        destData.loc_lat,
                        destData.loc_lon,
                        destData.loc_type,
                        destData.loc_attr,
                    ]),
                    sendToClients(destData),
                ]);
            } else {
                logger?.error(`Invalid: ${livemapValidator.errorsText()}`);
                destData = null;
            }
        }
    } catch (err) {
        logger?.error(`Ingester for '${format}' failed. ${err.message}`);
    }
    return destData;
}
