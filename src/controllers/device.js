import * as dev from '../models/device.js';

export async function getAllDevices(req, res) {
    const queryRes = await dev.getAllDevices();
    if (queryRes.rowCount < 0) {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
    }
}

export async function getDevicesByUserId(req, res) {
    const userId = req.tokenPayload && req.tokenPayload.userId;
    if (userId) {
        const queryRes1 = await dev.getOwnedDevicesByField('user_id', userId);
        let ownedDevices = null;
        if (queryRes1.rowCount >= 0) {
            ownedDevices = queryRes1.rows;
        }
        const queryRes2 = await dev.getSharedDevicesByField('user_id', userId);
        let sharedDevices = null;
        if (queryRes2.rowCount >= 0) {
            sharedDevices = queryRes2.rows;
        }
        if (ownedDevices === null || sharedDevices === null) {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(ownedDevices.concat(sharedDevices));
        }
    } else {
        res.status(403).send();
    }
}

export async function addDeviceByUserId(req, res) {
    const userId = req.tokenPayload && req.tokenPayload.userId;
    if (userId) {
        const queryRes = await dev.addDeviceByUserId(userId, req.body);
        if (queryRes.rowCount < 0) {
            res.status(500).send(`Internal Server Error`);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(201).send();
            } else {
                res.status(409).send();
            }
        }
    } else {
        res.status(403).send();
    }
}

export async function modifyDeviceByUserId(req, res) {
    const userId = req.tokenPayload && req.tokenPayload.userId;
    if (userId) {
        const queryRes = await dev.modifyDeviceByUserId(userId, req.body);
        if (queryRes.rowCount < 0) {
            res.status(500).send(`Internal Server Error`);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(204).send();
            } else {
                res.status(404).send();
            }
        }
    } else {
        res.status(403).send();
    }
}

export async function removeDevicesByUserId(req, res) {
    const userId = req.tokenPayload && req.tokenPayload.userId;
    if (userId) {
        const queryRes = await dev.deleteDevicesByUserId(
            userId,
            req.params.deviceIds.split(','),
        );
        if (queryRes.rowCount < 0) {
            res.status(500).send(`Internal Server Error`);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(204).send();
            } else {
                res.status(404).send();
            }
        }
    } else {
        res.status(403).send();
    }
}

export async function addSharedUserByUserId(req, res) {
    const userId = req.tokenPayload && req.tokenPayload.userId;
    if (userId) {
        const queryRes = await dev.addSharedUserByUserId(
            userId,
            req.body,
            req.params.deviceIds.split(','),
        );
        if (queryRes.rowCount < 0) {
            res.status(500).send(`Internal Server Error`);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(201).send();
            } else {
                res.status(409).send();
            }
        }
    } else {
        res.status(403).send();
    }
}

export async function removeSharedUserByUserId(req, res) {
    const userId = req.tokenPayload && req.tokenPayload.userId;
    if (userId) {
        const queryRes = await dev.deleteSharedUserByUserId(
            userId,
            req.body,
            req.params.deviceIds.split(','),
        );
        if (queryRes.rowCount < 0) {
            res.status(500).send(`Internal Server Error`);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(204).send();
            } else {
                res.status(404).send();
            }
        }
    } else {
        res.status(403).send();
    }
}
