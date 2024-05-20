import * as dev from '../../src/models/device.js';
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
            throw new Error('Failed to add a user');
        }
        for (let device of devices) {
            const queryRes2 = await dev.addDevice(device);
            if (queryRes2.rowCount !== 1) {
                throw new Error('Failed to add device');
            }
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

export async function removeUserAndDevices(user) {
    try {
        const queryRes1 = await usr.getUserByField('username', user.username);
        if (queryRes1.rowCount <= 0) {
            throw new Error('No user found to remove');
        }
        user = queryRes1.rows[0];
        const queryRes2 = await dev.getOwnedDevicesByField(
            'user_id',
            user.user_id,
        );
        const ids = queryRes2.rows.map(({ device_id }) => device_id);
        await dev.deleteDevicesById(ids);
        const queryRes3 = await usr.deleteUser(requestUser, user);
        if (queryRes3.rowCount !== 1) {
            throw new Error('unable to remove user');
        }
    } catch (err) {
        throw new Error(err.message);
    }
}
