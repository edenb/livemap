import * as usr from '../models/user.js';
import { HttpError } from '../utils/error.js';

export async function getAllUsers(_req, res, next) {
    try {
        const { rows } = await usr.getAllUsers();
        res.status(200).send(rows);
    } catch (err) {
        next(err);
    }
}

export async function getUserByUserId(req, res, next) {
    try {
        const { rows, rowCount } = await usr.getUserByField(
            'user_id',
            Number(req.params?.userId),
        );
        if (rowCount > 0) {
            res.status(200).send(rows);
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
        const { rowCount } = await usr.modifyUser(
            { user_id: req.tokenPayload.userId, role: req.tokenPayload.role },
            { ...req.body, user_id: Number(req.params?.userId) },
        );
        if (rowCount > 0) {
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
        const { rowCount } = await usr.deleteUser(
            { user_id: req.tokenPayload.userId, role: req.tokenPayload.role },
            { user_id: Number(req.params?.userId) },
        );
        if (rowCount > 0) {
            res.status(204).send();
        } else {
            throw new HttpError(404, 'User not found');
        }
    } catch (err) {
        next(err);
    }
}

export async function changePassword(req, res, next) {
    try {
        const { rowCount } = await usr.changePassword(
            Number(req.params?.userId),
            req.body.newpwd,
            req.body.confirmpwd,
            req.body.currentpwd,
        );
        if (rowCount > 0) {
            res.status(201).send();
        } else {
            throw new HttpError(422, 'User and password do not match');
        }
    } catch (err) {
        next(err);
    }
}

export async function resetPassword(req, res, next) {
    try {
        const { rowCount } = await usr.resetPassword(
            Number(req.params?.userId),
            req.body.newpwd,
            req.body.confirmpwd,
        );
        if (rowCount > 0) {
            res.status(201).send();
        } else {
            throw new HttpError(404, 'User not found');
        }
    } catch (err) {
        next(err);
    }
}

export async function getAccount(req, res, next) {
    try {
        const { rows } = await usr.getUserByField(
            'user_id',
            req.tokenPayload.userId,
        );
        res.status(200).send(rows[0]);
    } catch (err) {
        next(err);
    }
}
