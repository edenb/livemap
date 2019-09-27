"use strict";
const db = require('./db.js');
const logger = require('./logger.js');

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
    } catch(err) {
        queryRes.userMessage = 'Unable to get devices';
        return queryRes;
    }
}

async function getDeviceByIdentity(apiKey, identifier) {
    let queryRes = db.getEmptyQueryRes();
    // Check if the device is already loaded in memory
    let i = 0;
    while ((i < devices.length) && (devices[i].api_key !== apiKey || devices[i].identifier !== identifier)) {
        i++;
    }
    if (i !== devices.length) {
        logger.debug('findDeviceByIdentity - from memory: ' + JSON.stringify(devices[i]));
        queryRes.rowCount = 1;
        queryRes.rows = [devices[i]];
    } else {
        logger.debug('findDeviceByIdentity - from DB: ' + apiKey);
        try {
            queryRes = await db.queryDbAsync('insertDevice', [apiKey, identifier, identifier]);
        } catch(err) {
            logger.debug('findDeviceByIdentity - insert failed');
        }
        if (queryRes.rowCount === 1) {
            logger.debug('findDeviceByIdentity - new: ' + JSON.stringify(queryRes.rows[0]));
            devices.push(queryRes.rows[0]);
        }
    }
    return queryRes;
}

async function getDevicesByField(field, value) {
    let queryRes = db.getEmptyQueryRes();
    let queryDefinition = '';
    if (field === 'user_id') {
        queryDefinition = 'getDevicesByUserId';
    }
    if (queryDefinition !== '') {
        try {
            queryRes = await db.queryDbAsync(queryDefinition, [value]);
        } catch(err) {
            queryRes.userMessage = 'Unable to find devices.';
        }
    }
    return queryRes;
}

async function changeDevice(modDevice) {
    let queryRes = db.getEmptyQueryRes();
    if (modDevice.device_id === 0) {
        try {
            queryRes = await db.queryDbAsync('insertDevice', [modDevice.api_key, modDevice.identifier, modDevice.alias]);
            if (queryRes.rowCount === 0) {
                queryRes.userMessage = 'Unable to add device';
            }
        } catch(err) {
            queryRes.userMessage = 'Unable to add device';
        }
    } else {
        try {
            queryRes = await db.queryDbAsync('changeDeviceById', [modDevice.device_id, modDevice.alias, modDevice.fixed_loc_lat, modDevice.fixed_loc_lon]);
            if (queryRes.rowCount === 0) {
                queryRes.userMessage = 'Unable to change device';
            }
        } catch(err) {
            queryRes.userMessage = 'Unable to change device';
        }
    }
    return queryRes;
}

function splitDeviceIdentity(devIdent, dividerChar) {
    let dividerIdx, identityObj = {};

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
        if (devIdent.length - dividerIdx - 1 < 2 || devIdent.length - dividerIdx - 1 > 50) {
            identityObj.err = 'Identifier should be between 2 - 50 characters';
        } else {
            identityObj.apiKey = devIdent.slice(0, dividerIdx);
            identityObj.identifier = devIdent.slice(dividerIdx + 1);
        }
    }
    logger.debug('splitDeviceIdentity: ' + identityObj.err + ' ' + identityObj.apiKey + ' ' + identityObj.identifier + ' ');
    return identityObj;
}

async function addSharedUser(sharedUser, ids) {
    // ToDo: check for valid sharedUser and ids ?
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('addSharedUser', [sharedUser, ids]);
        if (queryRes.rowCount === 0) {
            queryRes.userMessage = 'No shared users were added';
        }
    } catch(err) {
        queryRes.userMessage = 'No shared users were added';
    }
    return queryRes;
}

async function deleteSharedUser(sharedUser, ids) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('deleteSharedUser', [sharedUser, ids]);
        if (queryRes.rowCount === 0) {
            queryRes.userMessage = 'No shared users were deleted';
        }
    } catch(err) {
        queryRes.userMessage = 'No shared users were deleted';
    }
    return queryRes;
}

async function deleteDevicesById(ids) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('deleteDevices', [ids]);
        if (queryRes.rowCount === 0) {
            queryRes.userMessage = 'No devices were deleted';
        }
    } catch(err) {
        queryRes.userMessage = 'No devices were deleted';
    }
    return queryRes;
}

module.exports.getAllDevices = getAllDevices;
module.exports.getDeviceByIdentity = getDeviceByIdentity;
module.exports.getDevicesByField = getDevicesByField;
module.exports.changeDevice = changeDevice;
module.exports.splitDeviceIdentity = splitDeviceIdentity;
module.exports.addSharedUser = addSharedUser;
module.exports.deleteSharedUser = deleteSharedUser;
module.exports.deleteDevicesById = deleteDevicesById;
