import { queryDbAsync } from '../database/db.js';
import Logger from '../utils/logger.js';

const logger = Logger(import.meta.url);

//
// Exported modules
//

export async function getAllDevices() {
    return await queryDbAsync('getAllDevices', []);
}

export async function getAllowedDevices(userId) {
    return await queryDbAsync('getAllowedDevices', [userId]);
}

export async function getDeviceByIdentity(apiKey, identifier) {
    const { rows } = await getAllDevices();
    const foundDevice = rows.find(
        (e) => e.api_key === apiKey && e.identifier === identifier,
    );
    return foundDevice || null;
}

export async function getOwnedDevicesByUserId(userId) {
    return await queryDbAsync('getOwnedDevicesByUserId', [userId]);
}

export async function getSharedDevicesByUserId(userId) {
    return await queryDbAsync('getSharedDevicesByUserId', [userId]);
}

export async function addDevice(device) {
    return await queryDbAsync('insertDevice', [
        device.api_key,
        device.identifier,
        device.alias,
    ]);
}

export async function addDeviceByUserId(userId, device) {
    return await queryDbAsync('addDeviceByUserId', [
        userId,
        device.identifier,
        device.alias,
        device.fixed_loc_lat,
        device.fixed_loc_lon,
    ]);
}

export async function modifyDevice(device) {
    return await queryDbAsync('modifyDeviceById', [
        device.device_id,
        device.alias,
        device.fixed_loc_lat,
        device.fixed_loc_lon,
    ]);
}

export async function modifyDeviceByUserId(userId, device) {
    return await queryDbAsync('modifyDeviceByUserId', [
        userId,
        device.device_id,
        device.alias,
        device.fixed_loc_lat,
        device.fixed_loc_lon,
    ]);
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
    return await queryDbAsync('addSharedUser', [sharedUser, ids]);
}

export async function addSharedUserByUserId(userId, sharedUser, ids) {
    return await queryDbAsync('addSharedUserByUserId', [
        userId,
        sharedUser.username,
        ids,
    ]);
}

export async function deleteSharedUser(sharedUser, ids) {
    return await queryDbAsync('deleteSharedUser', [sharedUser, ids]);
}

export async function deleteSharedUserByUserId(userId, sharedUser, ids) {
    return await queryDbAsync('deleteSharedUserByUserId', [
        userId,
        sharedUser.username,
        ids,
    ]);
}

export async function deleteDevicesById(ids) {
    return await queryDbAsync('deleteDevices', [ids]);
}

export async function deleteDevicesByUserId(userId, ids) {
    return await queryDbAsync('deleteDevicesByUserId', [userId, ids]);
}
