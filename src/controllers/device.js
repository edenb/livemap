import * as dev from '../models/device.js';
import * as usr from '../models/user.js';
import { HttpError } from '../utils/error.js';

export async function getAllDevices(_req, res, next) {
    try {
        const { rows } = await dev.getAllDevices();
        res.status(200).send(rows);
    } catch (err) {
        next(err);
    }
}

export async function getDevicesByUserId(req, res, next) {
    try {
        const [user, owned, shared] = await Promise.all([
            usr.getUserByField('user_id', Number(req.params?.userId)),
            dev.getOwnedDevicesByUserId(Number(req.params?.userId)),
            dev.getSharedDevicesByUserId(Number(req.params?.userId)),
        ]);
        if (user.rowCount > 0) {
            res.status(200).send(owned.rows.concat(shared.rows));
        } else {
            throw new HttpError(404, 'User not found');
        }
    } catch (err) {
        next(err);
    }
}

export async function addDeviceByUserId(req, res, next) {
    try {
        const { rowCount } = await dev.addDeviceByUserId(
            Number(req.params?.userId),
            req.body,
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

export async function modifyDeviceByUserId(req, res, next) {
    try {
        const { rowCount } = await dev.modifyDeviceByUserId(
            Number(req.params?.userId),
            req.body,
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

export async function removeDevicesByUserId(req, res, next) {
    try {
        const { rowCount } = await dev.deleteDevicesByUserId(
            Number(req.params?.userId),
            req.params.deviceIds.split(','),
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

export async function addSharedUserByUserId(req, res, next) {
    try {
        const { rowCount } = await dev.addSharedUserByUserId(
            Number(req.params?.userId),
            req.body,
            req.params.deviceIds.split(','),
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

export async function removeSharedUserByUserId(req, res, next) {
    try {
        const { rowCount } = await dev.deleteSharedUserByUserId(
            Number(req.params?.userId),
            req.body,
            req.params.deviceIds.split(','),
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
