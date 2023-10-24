'use strict';
const dev = require('../models/device');

//Check if the user in the request is the same user as making the request
function userAllowed(reqUserId, tokenUserId) {
    if (reqUserId && tokenUserId) {
        try {
            return parseInt(reqUserId) === parseInt(tokenUserId);
        } catch {
            return false;
        }
    } else {
        return false;
    }
}

exports.getAllDevices = async (req, res) => {
    const queryRes = await dev.getAllDevices();
    if (queryRes.rowCount < 0) {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
    }
};

exports.getDevicesByUserId = async (req, res) => {
    const reqUserId = req.params && req.params.userId;
    const tokenUserId = req.tokenPayload && req.tokenPayload.userId;
    if (userAllowed(reqUserId, tokenUserId)) {
        const queryRes1 = await dev.getOwnedDevicesByField(
            'user_id',
            reqUserId,
        );
        let ownedDevices = null;
        if (queryRes1.rowCount >= 0) {
            ownedDevices = queryRes1.rows;
        }
        const queryRes2 = await dev.getSharedDevicesByField(
            'user_id',
            reqUserId,
        );
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
};

exports.addDeviceByUserId = async (req, res) => {
    const reqUserId = req.params && req.params.userId;
    const tokenUserId = req.tokenPayload && req.tokenPayload.userId;
    if (userAllowed(reqUserId, tokenUserId)) {
        const queryRes = await dev.addDeviceByUserId(reqUserId, req.body);
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
};

exports.modifyDeviceByUserId = async (req, res) => {
    const reqUserId = req.params && req.params.userId;
    const tokenUserId = req.tokenPayload && req.tokenPayload.userId;
    if (userAllowed(reqUserId, tokenUserId)) {
        const queryRes = await dev.modifyDeviceByUserId(reqUserId, req.body);
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
};

exports.removeDevicesByUserId = async (req, res) => {
    const reqUserId = req.params && req.params.userId;
    const tokenUserId = req.tokenPayload && req.tokenPayload.userId;
    if (userAllowed(reqUserId, tokenUserId)) {
        const queryRes = await dev.deleteDevicesByUserId(
            reqUserId,
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
};

exports.addSharedUserByUserId = async (req, res) => {
    const reqUserId = req.params && req.params.userId;
    const tokenUserId = req.tokenPayload && req.tokenPayload.userId;
    if (userAllowed(reqUserId, tokenUserId)) {
        const queryRes = await dev.addSharedUserByUserId(
            reqUserId,
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
};

exports.removeSharedUserByUserId = async (req, res) => {
    const reqUserId = req.params && req.params.userId;
    const tokenUserId = req.tokenPayload && req.tokenPayload.userId;
    if (userAllowed(reqUserId, tokenUserId)) {
        const queryRes = await dev.deleteSharedUserByUserId(
            reqUserId,
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
};
