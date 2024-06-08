import * as dev from '../../src/models/device.js';
import * as pos from '../../src/models/position.js';
import * as usr from '../../src/models/user.js';

const requestUser = {
    user_id: 0,
    username: 'requestUser',
    fullName: 'Request User',
    email: 'test@requestuser',
    role: 'viewer',
    api_key: '00000000',
    password: 'requestUser',
};

export async function addUserAndDevices(user, devices) {
    try {
        const queryRes1 = await usr.addUser(requestUser, user);
        if (queryRes1.rowCount !== 1) {
            throw new Error('Failed to add a user.', queryRes1.userMessage);
        }
        for (let device of devices) {
            const queryRes2 = await dev.addDevice(device);
            if (queryRes2.rowCount !== 1) {
                throw new Error('Failed to add device.', queryRes2.userMessage);
            }
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function addShare(user, ids) {
    try {
        const queryRes = await dev.addSharedUser(user.username, ids);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No shared users were added';
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function removeUserAndDevices(fromUser) {
    try {
        const user = await getUser(fromUser);
        if (user) {
            const queryRes1 = await dev.getOwnedDevicesByField(
                'user_id',
                user.user_id,
            );
            const ids = queryRes1.rows.map(({ device_id }) => device_id);
            await dev.deleteDevicesById(ids);
            const queryRes2 = await usr.deleteUser(requestUser, user);
            if (queryRes2.rowCount !== 1) {
                throw new Error('Unable to remove user');
            }
            // Update in-memory user list and device list
            await usr.getAllUsers();
            await dev.getAllDevices();
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function getUser(user) {
    try {
        const queryRes = await usr.getUserByField('username', user.username);
        if (queryRes.rowCount <= 0) {
            return null;
        }
        return queryRes.rows[0];
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function getDevices(fromUser) {
    try {
        const user = await getUser(fromUser);
        const queryRes = await dev.getAllowedDevices(user.user_id);
        if (queryRes.rowCount <= 0) {
            return [];
        }
        return queryRes.rows;
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function addPosition(position) {
    try {
        const queryRes = await pos.insertPosition([
            position.device_id,
            position.device_id_tag,
            position.loc_timestamp,
            position.loc_lat,
            position.loc_lon,
            position.loc_type,
            position.loc_attr,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'No position inserted';
        }
    } catch (err) {
        throw new Error(err.message);
    }
}
