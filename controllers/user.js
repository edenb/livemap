'use strict';
const usr = require('../models/user');
const jwt = require('../auth/jwt');

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

exports.addUser = async (req, res) => {
    if (req.decodedToken) {
        const queryRes = await usr.addUser(
            { user_id: req.decodedToken.userId, role: req.decodedToken.role },
            req.body
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

exports.modifyUser = async (req, res) => {
    let reqUserId = -1;
    if (req.params && req.params.userId) {
        reqUserId = parseInt(req.params.userId) || -1;
    }
    if (reqUserId >= 0 && req.decodedToken) {
        req.body.user_id = reqUserId;
        const queryRes = await usr.modifyUser(
            { user_id: req.decodedToken.userId, role: req.decodedToken.role },
            req.body
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

exports.removeUser = async (req, res) => {
    let reqUserId = -1;
    if (req.params && req.params.userId) {
        reqUserId = parseInt(req.params.userId) || -1;
    }
    if (reqUserId >= 0 && req.decodedToken) {
        const queryRes = await usr.deleteUser(
            { user_id: req.decodedToken.userId, role: req.decodedToken.role },
            { user_id: reqUserId }
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

exports.getAccount = async (req, res) => {
    let token = '';
    if (
        req.headers.authorization &&
        req.headers.authorization.split(' ')[0] === 'Bearer'
    ) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (token !== '') {
        const payload = jwt.getTokenPayload(token);
        if (payload.userId) {
            const userId = parseInt(payload.userId);
            if (!Number.isInteger(userId)) {
                res.status(400).send(`Bad Request`);
            } else {
                const queryRes = await usr.getUserByField('user_id', userId);
                if (typeof queryRes.userMessage !== 'undefined') {
                    res.status(500).send(`Internal Server Error`);
                } else {
                    let response = {};
                    response.user_id = queryRes.rows[0].user_id;
                    response.username = queryRes.rows[0].username;
                    response.role = queryRes.rows[0].role;
                    response.api_key = queryRes.rows[0].api_key;
                    response.fullname = queryRes.rows[0].fullname;
                    response.email = queryRes.rows[0].email;
                    res.status(200).send(response);
                }
            }
        }
    }
};
