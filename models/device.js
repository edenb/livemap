'use strict';
const db = require('../database/db');
const logger = require('../utils/logger');

var devices = [];

//
// Exported modules
//

async function getAllDevices() {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('getAllDevices', []);
        devices = queryRes.rows;
        return queryRes;
    } catch (err) {
        queryRes.userMessage = 'Unable to get devices';
        return queryRes;
    }
}

async function getAllowedDevices(userId) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('getAllowedDevices', [userId]);
        devices = queryRes.rows;
        return queryRes;
    } catch (err) {
        queryRes.userMessage = 'Unable to get allowed devices';
        return queryRes;
    }
}

async function getDeviceByIdentity(apiKey, identifier) {
    let queryRes = db.getEmptyQueryRes();
    // Check if the device is already loaded in memory
    let i = 0;
    while (
        i < devices.length &&
        (devices[i].api_key !== apiKey || devices[i].identifier !== identifier)
    ) {
        i++;
    }
    if (i !== devices.length) {
        logger.debug(
            'findDeviceByIdentity - from memory: ' + JSON.stringify(devices[i])
        );
        queryRes.rowCount = 1;
        queryRes.rows = [devices[i]];
    } else {
        logger.debug('findDeviceByIdentity - from DB: ' + apiKey);
        try {
            queryRes = await db.queryDbAsync('insertDevice', [
                apiKey,
                identifier,
                identifier,
            ]);
        } catch (err) {
            logger.debug('findDeviceByIdentity - insert failed');
        }
        if (queryRes.rowCount === 1) {
            logger.debug(
                'findDeviceByIdentity - new: ' +
                    JSON.stringify(queryRes.rows[0])
            );
            devices.push(queryRes.rows[0]);
        }
    }
    return queryRes;
}

async function getOwnedDevicesByField(field, value) {
    let queryRes = db.getEmptyQueryRes();
    let queryDefinition = '';
    if (field === 'user_id') {
        queryDefinition = 'getOwnedDevicesByUserId';
    }
    if (queryDefinition !== '') {
        try {
            queryRes = await db.queryDbAsync(queryDefinition, [value]);
        } catch (err) {
            queryRes.userMessage = 'Unable to find devices.';
        }
    }
    return queryRes;
}

async function getSharedDevicesByField(field, value) {
    let queryRes = db.getEmptyQueryRes();
    let queryDefinition = '';
    if (field === 'user_id') {
        queryDefinition = 'getSharedDevicesByUserId';
    }
    if (queryDefinition !== '') {
        try {
            queryRes = await db.queryDbAsync(queryDefinition, [value]);
        } catch (err) {
            queryRes.userMessage = 'Unable to find devices.';
        }
    }
    return queryRes;
}

async function addDevice(device) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('insertDevice', [
            device.api_key,
            device.identifier,
            device.alias,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'Unable to add device';
        }
    } catch (err) {
        queryRes.userMessage = 'Unable to add device';
    }
    return queryRes;
}

async function addDeviceByUserId(userId, device) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('addDeviceByUserId', [
            userId,
            device.identifier,
            device.alias,
            device.fixed_loc_lat,
            device.fixed_loc_lon,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'Unable to add device';
        }
    } catch (err) {
        queryRes.userMessage = 'Unable to add device';
    }
    return queryRes;
}

async function modifyDevice(device) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('modifyDeviceById', [
            device.device_id,
            device.alias,
            device.fixed_loc_lat,
            device.fixed_loc_lon,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'Unable to change device';
        }
    } catch (err) {
        queryRes.userMessage = 'Unable to change device';
    }
    return queryRes;
}

async function modifyDeviceByUserId(userId, device) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('modifyDeviceByUserId', [
            userId,
            device.device_id,
            device.alias,
            device.fixed_loc_lat,
            device.fixed_loc_lon,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'Unable to change device';
        }
    } catch (err) {
        queryRes.userMessage = 'Unable to change device';
    }
    return queryRes;
}

function splitDeviceIdentity(devIdent, dividerChar) {
    let dividerIdx;
    let identityObj = {};

    // Return object with API key and identifier. A valid identity returns err = null, otherwise err = <error string>
    identityObj.apiKey = null;
    identityObj.identifier = null;
    identityObj.err = null;

    // Be sure that identity is defined and a string
    if (typeof devIdent !== 'string') {
        devIdent = '';
    }
    dividerIdx = devIdent.indexOf(dividerChar);
    if (dividerIdx < 7) {
        if (dividerIdx < 0) {
            identityObj.err = 'No divider (' + dividerChar + ') found';
        } else {
            identityObj.err = 'API key too short';
        }
    } else {
        // Check if identifier is 2 - 50 characters long
        if (
            devIdent.length - dividerIdx - 1 < 2 ||
            devIdent.length - dividerIdx - 1 > 50
        ) {
            identityObj.err = 'Identifier should be between 2 - 50 characters';
        } else {
            identityObj.apiKey = devIdent.slice(0, dividerIdx);
            identityObj.identifier = devIdent.slice(dividerIdx + 1);
        }
    }
    logger.debug(
        'splitDeviceIdentity: ' +
            identityObj.err +
            ' ' +
            identityObj.apiKey +
            ' ' +
            identityObj.identifier +
            ' '
    );
    return identityObj;
}

async function addSharedUser(sharedUser, ids) {
    // ToDo: check for valid sharedUser and ids ?
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('addSharedUser', [sharedUser, ids]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No shared users were added';
        }
    } catch (err) {
        queryRes.userMessage = 'No shared users were added';
    }
    return queryRes;
}

async function addSharedUserByUserId(userId, sharedUser, ids) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('addSharedUserByUserId', [
            userId,
            sharedUser.username,
            ids,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No shared users were added';
        }
    } catch (err) {
        queryRes.userMessage = 'No shared users were added';
    }
    return queryRes;
}

async function deleteSharedUser(sharedUser, ids) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('deleteSharedUser', [sharedUser, ids]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No shared users were deleted';
        }
    } catch (err) {
        queryRes.userMessage = 'No shared users were deleted';
    }
    return queryRes;
}

async function deleteSharedUserByUserId(userId, sharedUser, ids) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('deleteSharedUserByUserId', [
            userId,
            sharedUser.username,
            ids,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No shared users were deleted';
        }
    } catch (err) {
        queryRes.userMessage = 'No shared users were deleted';
    }
    return queryRes;
}

async function deleteDevicesById(ids) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('deleteDevices', [ids]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No devices were deleted';
        }
    } catch (err) {
        queryRes.userMessage = 'No devices were deleted';
    }
    return queryRes;
}

async function deleteDevicesByUserId(userId, ids) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('deleteDevicesByUserId', [
            userId,
            ids,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No devices were deleted';
        }
    } catch (err) {
        queryRes.userMessage = 'No devices were deleted';
    }
    return queryRes;
}

module.exports.getAllDevices = getAllDevices;
module.exports.getAllowedDevices = getAllowedDevices;
module.exports.getDeviceByIdentity = getDeviceByIdentity;
module.exports.getOwnedDevicesByField = getOwnedDevicesByField;
module.exports.getSharedDevicesByField = getSharedDevicesByField;
module.exports.addDevice = addDevice;
module.exports.addDeviceByUserId = addDeviceByUserId;
module.exports.modifyDevice = modifyDevice;
module.exports.modifyDeviceByUserId = modifyDeviceByUserId;
module.exports.splitDeviceIdentity = splitDeviceIdentity;
module.exports.addSharedUser = addSharedUser;
module.exports.addSharedUserByUserId = addSharedUserByUserId;
module.exports.deleteSharedUser = deleteSharedUser;
module.exports.deleteSharedUserByUserId = deleteSharedUserByUserId;
module.exports.deleteDevicesById = deleteDevicesById;
module.exports.deleteDevicesByUserId = deleteDevicesByUserId;
