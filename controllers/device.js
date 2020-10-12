"use strict";
const dev = require('../models/device');
const jwt = require('../auth/jwt');

exports.getAllDevices = async (req, res) => {
    const queryRes = await dev.getAllDevices();
    if (queryRes.rowCount < 0) {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
    }
};

exports.getDevicesByUserId = async (req, res) => {
    let reqUserId = -1;
    if (req.params && req.params.userId) {
        reqUserId = parseInt(req.params.userId) || -1;
    }
    let tokenUserId = -1;
    if (req.headers && req.headers.authorization) {
        tokenUserId = jwt.getUserId(req.headers.authorization);
    }
    if (reqUserId >= 0 && tokenUserId >= 0 && reqUserId === tokenUserId) {
        const queryRes1 = await dev.getOwnedDevicesByField('user_id', reqUserId);
        let ownedDevices = null;
        if (queryRes1.rowCount >= 0) {
            ownedDevices = queryRes1.rows;
        }
        const queryRes2 = await dev.getSharedDevicesByField('user_id', reqUserId);
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
        res.status(401).send('Unauthorized.');
    }
};

exports.addDevice = async (req, res) => {
    const queryRes = await dev.changeDevice(req.body);
    if (queryRes.rowCount < 0) {
        res.status(500).send(`Internal Server Error`);
    } else {
        if (queryRes.rowCount > 0) {
            res.status(201).send();
        } else {
            res.status(409).send();
        }
    }
};

exports.modifyDevice = async (req, res) => {
    const queryRes = await dev.changeDevice(req.body);
    if (queryRes.rowCount < 0) {
        res.status(500).send(`Internal Server Error`);
    } else {
        if (queryRes.rowCount > 0) {
            res.status(204).send();
        } else {
            res.status(404).send();
        }
    }
};

exports.removeDevices = async (req, res) => {
    const queryRes = await dev.deleteDevicesById(req.params.deviceIds.split(','));
    if (queryRes.rowCount < 0) {
        res.status(500).send(`Internal Server Error`);
    } else {
        if (queryRes.rowCount > 0) {
            res.status(204).send();
        } else {
            res.status(404).send();
        }
    }
};
