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
        const { rowCount } = await usr.addUser(requestUser, user);
        if (rowCount !== 1) {
            throw new Error('Failed to add a user');
        }
        for (let device of devices) {
            const { rowCount } = await dev.addDevice(device);
            if (rowCount !== 1) {
                throw new Error('Failed to add device');
            }
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function addShare(user, ids) {
    try {
        const { rowCount } = await dev.addSharedUser(user.username, ids);
        if (rowCount <= 0) {
            throw new Error('No shared users were added');
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function removeUserAndDevices(fromUser) {
    try {
        const user = await getUser(fromUser);
        if (user) {
            const { rows: owned } = await dev.getOwnedDevicesByUserId(
                user.user_id,
            );
            const ids = owned.map(({ device_id }) => device_id);
            await dev.deleteDevicesById(ids);
            const { rowCount } = await usr.deleteUser(requestUser, user);
            if (rowCount !== 1) {
                throw new Error('Unable to remove user');
            }
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function getUser(user) {
    try {
        const { rows } = await usr.getUserByField('username', user.username);
        return rows[0] || null;
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function getDevices(fromUser) {
    try {
        const user = await getUser(fromUser);
        const { rows } = await dev.getAllowedDevices(user.user_id);
        return rows;
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function addPosition(position) {
    try {
        await pos.insertPosition([
            position.device_id,
            position.device_id_tag,
            position.loc_timestamp,
            position.loc_lat,
            position.loc_lon,
            position.loc_type,
            position.loc_attr,
        ]);
    } catch (err) {
        throw new Error(err.message);
    }
}
