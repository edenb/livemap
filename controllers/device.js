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
