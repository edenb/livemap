import { queryDbAsync } from '../database/db.js';
import Logger from '../utils/logger.js';

const logger = Logger(import.meta.url);

//
// Exported modules
//

export async function getAllDevices() {
    const queryRes = await queryDbAsync('getAllDevices', []);
    return queryRes;
}

export async function getAllowedDevices(userId) {
    const queryRes = await queryDbAsync('getAllowedDevices', [userId]);
    return queryRes;
}

export async function getDeviceByIdentity(apiKey, identifier) {
    const queryRes = await getAllDevices();
    const foundDevice = queryRes.rows.find(
        (e) => e.api_key === apiKey && e.identifier === identifier,
    );
    return foundDevice || null;
}

export async function getOwnedDevicesByUserId(userId) {
    const queryRes = await queryDbAsync('getOwnedDevicesByUserId', [userId]);
    return queryRes;
}

export async function getSharedDevicesByUserId(userId) {
    const queryRes = await queryDbAsync('getSharedDevicesByUserId', [userId]);
    return queryRes;
}

export async function addDevice(device) {
    const queryRes = await queryDbAsync('insertDevice', [
        device.api_key,
        device.identifier,
        device.alias,
    ]);
    return queryRes;
}

export async function addDeviceByUserId(userId, device) {
    const queryRes = await queryDbAsync('addDeviceByUserId', [
        userId,
        device.identifier,
        device.alias,
        device.fixed_loc_lat,
        device.fixed_loc_lon,
    ]);
    return queryRes;
}

export async function modifyDevice(device) {
    const queryRes = await queryDbAsync('modifyDeviceById', [
        device.device_id,
        device.alias,
        device.fixed_loc_lat,
        device.fixed_loc_lon,
    ]);
    return queryRes;
}

export async function modifyDeviceByUserId(userId, device) {
    const queryRes = await queryDbAsync('modifyDeviceByUserId', [
        userId,
        device.device_id,
        device.alias,
        device.fixed_loc_lat,
        device.fixed_loc_lon,
    ]);
    return queryRes;
}

export function splitDeviceIdentity(devIdent, dividerChar) {
    // Device identity format: <apiKey><divider><identifier>
    // A device identity should be a string
    if (typeof devIdent !== 'string') {
        throw new Error('Device identity should be a string');
    }
    const dividerIdx = devIdent.indexOf(dividerChar);
    // A device identity should contain a divider character
    if (dividerIdx === -1) {
        throw new Error(`No divider (${dividerChar}) found`);
    }
    const apiKey = devIdent.slice(0, dividerIdx);
    const identifier = devIdent.slice(dividerIdx + 1);
    // An api key has at least 7 characters
    if (apiKey.length < 7) {
        throw new Error('API key too short');
    }
    // An identifier has 2 - 50 characters
    if (identifier.length < 2 || identifier.length > 50) {
        throw new Error('Identifier should be between 2 - 50 characters');
    }
    logger.debug(`splitDeviceIdentity: ${apiKey} ${identifier}`);
    return { apiKey, identifier };
}

export async function addSharedUser(sharedUser, ids) {
    // ToDo: check for valid sharedUser and ids ?
    const queryRes = await queryDbAsync('addSharedUser', [sharedUser, ids]);
    return queryRes;
}

export async function addSharedUserByUserId(userId, sharedUser, ids) {
    const queryRes = await queryDbAsync('addSharedUserByUserId', [
        userId,
        sharedUser.username,
        ids,
    ]);
    return queryRes;
}

export async function deleteSharedUser(sharedUser, ids) {
    const queryRes = await queryDbAsync('deleteSharedUser', [sharedUser, ids]);
    return queryRes;
}

export async function deleteSharedUserByUserId(userId, sharedUser, ids) {
    const queryRes = await queryDbAsync('deleteSharedUserByUserId', [
        userId,
        sharedUser.username,
        ids,
    ]);
    return queryRes;
}

export async function deleteDevicesById(ids) {
    const queryRes = await queryDbAsync('deleteDevices', [ids]);
    return queryRes;
}

export async function deleteDevicesByUserId(userId, ids) {
    const queryRes = await queryDbAsync('deleteDevicesByUserId', [userId, ids]);
    return queryRes;
}
