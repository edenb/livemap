"use strict";
const dev = require('../models/device');

exports.getAllDevices = async (req, res) => {
    const queryRes = await dev.getAllDevices();
    if (typeof queryRes.userMessage !== 'undefined') {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
    }
};

exports.addDevice = async (req, res) => {
    const queryRes = await dev.changeDevice(req.body);
    if (typeof queryRes.userMessage !== 'undefined') {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(201).send(queryRes.rows[0]);
    }
};

exports.modifyDevice = async (req, res) => {
    const queryRes = await dev.changeDevice(req.body);
    if (typeof queryRes.userMessage !== 'undefined') {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(204).send();
    }
};

exports.removeDevice = async (req, res) => {
    //const deviceId = parseInt(req.params.deviceId);
    const queryRes = await dev.deleteDevicesById([req.params.deviceId]);
    if (typeof queryRes.userMessage !== 'undefined') {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(204).send();
    }
};
