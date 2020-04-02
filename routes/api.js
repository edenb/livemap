"use strict";
const express = require('express');
const jwt = require('../auth/jwt')
const users = require('../controllers/user');
const devices = require('../controllers/device');
const positions = require('../controllers/position');
const staticLayers = require('../controllers/staticlayer');

module.exports = (passport) => {
    const router = express.Router();

    // Enable CORS for API
    router.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS,DELETE');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
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
        // Check for same origin (client hostname == server hostname)
        const clientUrl = new URL(req.headers.origin);
        let serverUrl = new URL('http://localhost');
        serverUrl.host = req.headers.host;
        // Create cookie options for same origin/cross origin
        let cookieOptions = {
            expires: new Date(Date.now() + 8 * 3600000), // cookie will be removed after 8 hours
            httpOnly: true
        };
        if (clientUrl.hostname !== serverUrl.hostname) {
            cookieOptions.domain = req.headers.host;
            cookieOptions.sameSite = 'none';
            cookieOptions.secure = true;
        }

        res
            .status(200)
            .cookie('access_token', token, cookieOptions)
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
