"use strict";
const dev = require('../models/device');

exports.getAllDevices = async (req, res) => {
    const queryRes = await dev.getAllDevices();
    if (queryRes.rowCount < 0) {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
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

exports.removeDevice = async (req, res) => {
    const queryRes = await dev.deleteDevicesById([req.params.deviceId]);
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
