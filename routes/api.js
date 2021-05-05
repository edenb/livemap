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
            'GET,PUT,POST,OPTIONS,DELETE'
        );
        res.header(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization'
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

    router.get('/account', jwt.checkScopes('acc_o..r..'), users.getAccount);

    router.get('/users', jwt.checkScopes('usr_.a.r..'), users.getAllUsers);

    router.post('/users', jwt.checkScopes('usr_.ac...'), users.addUser);

    router.put(
        '/users/:userId',
        jwt.checkScopes('usr_.a..u.'),
        users.modifyUser
    );

    router.delete(
        '/users/:userId',
        jwt.checkScopes('usr_.a...d'),
        users.removeUser
    );

    router.get(
        '/users/:userId',
        jwt.checkScopes('usr_o..r..'),
        users.getUserByUserId
    );

    router.post(
        '/users/:userId/password/change',
        jwt.checkScopes('usr_o...u.'),
        users.changePassword
    );

    router.post(
        '/users/:userId/password/reset',
        jwt.checkScopes('usr_.a..u.'),
        users.resetPassword
    );

    router.get(
        '/users/:userId/devices',
        jwt.checkScopes('dev_o..r..'),
        devices.getDevicesByUserId
    );

    router.post(
        '/users/:userId/devices',
        jwt.checkScopes('dev_o.c...'),
        devices.addDeviceByUserId
    );

    router.put(
        '/users/:userId/devices/:deviceId',
        jwt.checkScopes('dev_o...u.'),
        devices.modifyDeviceByUserId
    );

    router.delete(
        '/users/:userId/devices/:deviceIds',
        jwt.checkScopes('dev_o....d'),
        devices.removeDevicesByUserId
    );

    router.post(
        '/users/:userId/devices/:deviceIds/shareduser',
        jwt.checkScopes('sha_o.c...'),
        devices.addSharedUserByUserId
    );

    router.delete(
        '/users/:userId/devices/:deviceIds/shareduser',
        jwt.checkScopes('sha_o....d'),
        devices.removeSharedUserByUserId
    );

    router.get(
        '/devices',
        jwt.checkScopes('dev_.a.r..'),
        devices.getAllDevices
    );

    router.get(
        '/positions',
        jwt.checkScopes('pos_o..r..'),
        positions.getLastPositions
    );

    router.get(
        '/staticlayers',
        jwt.checkScopes('lay_.a.r..'),
        staticLayers.getStaticLayers
    );

    router.get('/server/info', jwt.checkScopes('ser_.a.r..'), server.getInfo);

    // This middleware always at the end to catch undefined endpoints
    router.use('*', (req, res) => {
        res.status(404).send(`Invalid endpoint`);
    });

    return router;
};
