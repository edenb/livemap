'use strict';
const pos = require('../models/position');

exports.getLastPositions = async (req, res) => {
    const queryRes = await pos.getLastPositions(req.decodedToken.userId);
    if (typeof queryRes.userMessage !== 'undefined') {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
    }
};
