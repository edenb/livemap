"use strict";
const usr = require('../models/user');

exports.getAllUsers = async (req, res) => {
    const queryRes = await usr.getAllUsers();
    if (typeof queryRes.userMessage !== 'undefined') {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
    }
};

exports.getUserByUserId = async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (!Number.isInteger(userId)) {
        res.status(400).send(`Bad Request`);
    } else {
        const queryRes = await usr.getUserByField('user_id', userId);
        if (typeof queryRes.userMessage !== 'undefined') {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(queryRes.rows);
        }
    }
};
