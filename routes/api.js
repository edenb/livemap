'use strict';
const express = require('express');
const jwt = require('../auth/jwt');
const users = require('../controllers/user');
const devices = require('../controllers/device');
const positions = require('../controllers/position');
const staticLayers = require('../controllers/staticlayer');
const server = require('../controllers/server');

module.exports = (passport) => {
    const router = express.Router();

    // Enable CORS for API
    router.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header(
            'Access-Control-Allow-Methods',
            'GET,PUT,POST,OPTIONS,DELETE',
        );
        res.header(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization',
        );
        // intercept OPTIONS method
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });

    router.get('/', (req, res) => {
        res.status(200).send(`API V1 is up`);
    });

    router.post('/login', passport.authenticate('local'), (req, res) => {
        let token = jwt.getNewToken(req.user);
        res.status(200).json({
            access_token: token,
            token_type: 'Bearer',
        });
    });

    router.get(
        '/account',
        jwt.isAuthorized(['admin', 'manager', 'viewer']),
        users.getAccount,
    );

    router.get('/users', jwt.isAuthorized(['admin']), users.getAllUsers);

    router.post('/users', jwt.isAuthorized(['admin']), users.addUser);

    router.put('/users/:userId', jwt.isAuthorized(['admin']), users.modifyUser);

    router.delete(
        '/users/:userId',
        jwt.isAuthorized(['admin']),
        users.removeUser,
    );

    router.get(
        '/users/:userId',
        jwt.isAuthorized(['admin', 'manager', 'viewer']),
        users.getUserByUserId,
    );

    router.post(
        '/users/:userId/password/change',
        jwt.isAuthorized(['admin', 'manager', 'viewer']),
        users.changePassword,
    );

    router.post(
        '/users/:userId/password/reset',
        jwt.isAuthorized(['admin']),
        users.resetPassword,
    );

    router.get(
        '/users/:userId/devices',
        jwt.isAuthorized(['admin', 'manager', 'viewer']),
        devices.getDevicesByUserId,
    );

    router.post(
        '/users/:userId/devices',
        jwt.isAuthorized(['admin', 'manager']),
        devices.addDeviceByUserId,
    );

    router.put(
        '/users/:userId/devices/:deviceId',
        jwt.isAuthorized(['admin', 'manager']),
        devices.modifyDeviceByUserId,
    );

    router.delete(
        '/users/:userId/devices/:deviceIds',
        jwt.isAuthorized(['admin', 'manager']),
        devices.removeDevicesByUserId,
    );

    router.post(
        '/users/:userId/devices/:deviceIds/shareduser',
        jwt.isAuthorized(['admin', 'manager']),
        devices.addSharedUserByUserId,
    );

    router.delete(
        '/users/:userId/devices/:deviceIds/shareduser',
        jwt.isAuthorized(['admin', 'manager']),
        devices.removeSharedUserByUserId,
    );

    router.get('/devices', jwt.isAuthorized(['admin']), devices.getAllDevices);

    router.get(
        '/positions',
        jwt.isAuthorized(['admin', 'manager', 'viewer']),
        positions.getLastPositions,
    );

    router.get(
        '/staticlayers',
        jwt.isAuthorized(['admin', 'manager', 'viewer']),
        staticLayers.getStaticLayers,
    );

    router.get(
        '/server/info',
        jwt.isAuthorized(['admin', 'manager', 'viewer']),
        server.getInfo,
    );

    // This middleware always at the end to catch undefined endpoints
    router.use('*', (req, res) => {
        res.status(404).send(`Invalid endpoint`);
    });

    return router;
};
