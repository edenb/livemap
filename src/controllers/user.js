import * as usr from '../models/user.js';
import { HttpError } from '../utils/error.js';

export async function getAllUsers(_req, res, next) {
    try {
        const queryRes = await usr.getAllUsers();
        res.status(200).send(queryRes.rows);
    } catch (err) {
        next(err);
    }
}

export async function getUserByUserId(req, res, next) {
    try {
        const queryRes = await usr.getUserByField(
            'user_id',
            Number(req.params?.userId),
        );
        if (queryRes.rowCount > 0) {
            res.status(200).send(queryRes.rows);
        } else {
            throw new HttpError(404, 'User not found');
        }
    } catch (err) {
        next(err);
    }
}

export async function addUser(req, res, next) {
    try {
        await usr.addUser(
            {
                user_id: req.tokenPayload.userId,
                role: req.tokenPayload.role,
            },
            req.body,
        );
        res.status(201).send();
    } catch (err) {
        next(err);
    }
}

export async function modifyUser(req, res, next) {
    try {
        const queryRes = await usr.modifyUser(
            { user_id: req.tokenPayload.userId, role: req.tokenPayload.role },
            { ...req.body, user_id: Number(req.params?.userId) },
        );
        if (queryRes.rowCount > 0) {
            res.status(204).send();
        } else {
            throw new HttpError(404, 'User not found');
        }
    } catch (err) {
        next(err);
    }
}

export async function removeUser(req, res, next) {
    try {
        const queryRes = await usr.deleteUser(
            { user_id: req.tokenPayload.userId, role: req.tokenPayload.role },
            { user_id: Number(req.params?.userId) },
        );
        if (queryRes.rowCount > 0) {
            res.status(204).send();
        } else {
            throw new HttpError(404, 'User not found');
        }
    } catch (err) {
        next(err);
    }
}

export async function changePassword(req, res) {
    let reqUserId = -1;
    if (req.params && req.params.userId) {
        reqUserId = parseInt(req.params.userId) || -1;
    }
    if (
        reqUserId >= 0 &&
        req.tokenPayload &&
        reqUserId === req.tokenPayload.userId
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
                    req.body.confirmpwd,
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
}

export async function resetPassword(req, res) {
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
                    req.body.confirmpwd,
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
}

export async function getAccount(req, res, next) {
    try {
        const queryRes = await usr.getUserByField(
            'user_id',
            req.tokenPayload.userId,
        );
        // Do not expose password hash in response
        const { password, ...user } = queryRes.rows[0];
        res.status(200).send(user);
    } catch (err) {
        next(err);
    }
}
