'use strict';
const usr = require('../models/user');
const jwt = require('../auth/jwt');

exports.getAllUsers = async (req, res) => {
    const queryRes = await usr.getAllUsers();
    if (queryRes.rowCount === -1) {
        res.status(500).send(`Internal Server Error`);
    } else if (queryRes.rowCount === -2) {
        res.status(400).send(queryRes.userMessage);
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
        if (queryRes.rowCount === -1) {
            res.status(500).send(`Internal Server Error`);
        } else if (queryRes.rowCount === -2) {
            res.status(400).send(queryRes.userMessage);
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
        if (queryRes.rowCount === -1) {
            res.status(500).send(`Internal Server Error`);
        } else if (queryRes.rowCount === -2) {
            res.status(400).send(queryRes.userMessage);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(201).send();
            } else {
                res.status(409).send(queryRes.userMessage);
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
        if (queryRes.rowCount === -1) {
            res.status(500).send(`Internal Server Error`);
        } else if (queryRes.rowCount === -2) {
            res.status(400).send(queryRes.userMessage);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(204).send();
            } else {
                res.status(404).send(queryRes.userMessage);
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
        if (queryRes.rowCount === -1) {
            res.status(500).send(`Internal Server Error`);
        } else if (queryRes.rowCount === -2) {
            res.status(400).send(queryRes.userMessage);
        } else {
            if (queryRes.rowCount > 0) {
                res.status(204).send();
            } else {
                res.status(404).send(queryRes.userMessage);
            }
        }
    } else {
        res.status(403).send();
    }
};

exports.changePassword = async (req, res) => {
    let reqUserId = -1;
    if (req.params && req.params.userId) {
        reqUserId = parseInt(req.params.userId) || -1;
    }
    if (
        reqUserId >= 0 &&
        req.decodedToken &&
        reqUserId === req.decodedToken.userId
    ) {
        const queryRes1 = await usr.getUserByField('user_id', reqUserId);
        if (queryRes1.rowCount < 0) {
            res.status(500).send(`Internal Server Error`);
        } else {
            if (queryRes1.rowCount > 0 && req.body.curpwd !== null) {
                let queryRes2;
                queryRes2 = await usr.changePassword(
                    queryRes1.rows[0],
                    req.body.curpwd,
                    req.body.newpwd,
                    req.body.confirmpwd
                );
                if (queryRes2.rowCount === -1) {
                    res.status(500).send(`Internal Server Error`);
                } else if (queryRes2.rowCount === -2) {
                    res.status(400).send(queryRes2.userMessage);
                } else {
                    if (queryRes2.rowCount > 0) {
                        res.status(201).send();
                    } else {
                        res.status(409).send();
                    }
                }
            } else {
                res.status(409).send();
            }
        }
    } else {
        res.status(403).send();
    }
};

exports.resetPassword = async (req, res) => {
    let reqUserId = -1;
    if (req.params && req.params.userId) {
        reqUserId = parseInt(req.params.userId) || -1;
    }
    if (reqUserId >= 0) {
        const queryRes1 = await usr.getUserByField('user_id', reqUserId);
        if (queryRes1.rowCount < 0) {
            res.status(500).send(`Internal Server Error`);
        } else {
            if (queryRes1.rowCount > 0 && req.body.curpwd !== null) {
                let queryRes2;
                queryRes2 = await usr.resetPassword(
                    queryRes1.rows[0],
                    req.body.newpwd,
                    req.body.confirmpwd
                );
                if (queryRes2.rowCount === -1) {
                    res.status(500).send(`Internal Server Error`);
                } else if (queryRes2.rowCount === -2) {
                    res.status(400).send(queryRes2.userMessage);
                } else {
                    if (queryRes2.rowCount > 0) {
                        res.status(201).send();
                    } else {
                        res.status(409).send();
                    }
                }
            } else {
                res.status(409).send();
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
                if (queryRes.rowCount === -1) {
                    res.status(500).send(`Internal Server Error`);
                } else if (queryRes.rowCount === -2) {
                    res.status(400).send(queryRes.userMessage);
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
