"use strict";
const express = require('express');
const jwt = require('../auth/jwt')
const users = require('../controllers/user');
const devices = require('../controllers/device');
const positions = require('../controllers/position');
const staticLayers = require('../controllers/staticlayer');

module.exports = (passport) => {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.status(200).send(`API V1 is up`);
    });

    router.post('/login', passport.authenticate('local'), (req, res) => {
        let token = jwt.getNewToken(req.user);
        res
            .status(200)
            .json({
                access_token: token,
                token_type: 'Bearer'
            });
    });

    router.get('/account', jwt.checkScopes(['account']), users.getAccount);

    router.get('/users', jwt.checkScopes(['users']), users.getAllUsers);

    router.get('/users/:userId', jwt.checkScopes(['users']), users.getUserByUserId);

    router.get('/devices', jwt.checkScopes(['devices']), devices.getAllDevices);

    router.get('/positions', jwt.checkScopes(['positions']), positions.getLastPositions);

    router.get('/staticlayers', jwt.checkScopes(['staticlayers']), staticLayers.getStaticLayers);

    // This middleware always at the end to catch undefined endpoints
    router.use('*', (req, res) => {
        res.status(404).send(`Invalid endpoint`);
    });

    return router;
}
