"use strict";
const express = require('express');
const jwt = require('jsonwebtoken');
const usr = require('../src/user.js');
const dev = require('../src/device.js');

var router = express.Router();

function checkScopes(scopes) {
    return (req, res, next) => {
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            let token = req.headers.authorization.split(' ')[1];
            try {
                let options = {algorithm: 'HS512'};
                let decoded = jwt.verify(token, 'replacebysecretfromconfig', options);
                for (let i=0; i<decoded.scopes.length; i++) {
                    for (let j=0; j<scopes.length; j++) {
                        if(scopes[j] === decoded.scopes[i]) return next();
                    }
                }
                res.status(401).send('Unauthorized. Invalid scope');
            } catch(err) {
                res.status(401).send('Unauthorized. Invalid token');
            }
        } else {
            res.status(401).send('Unauthorized. Token required');
        }
    }
}

module.exports = function () {
    router.get('/', (req, res) => {
        res.status(200).send('API is up');
    });

    router.get ('/users', checkScopes(['users']), async (req, res) => {
        const queryRes = await usr.getAllUsers();
        if (typeof queryRes.userMessage !== 'undefined') {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(queryRes.rows);
        }
    });

    router.get ('/users/:userId', checkScopes(['users']), async (req, res) => {
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
    });

    router.get ('/devices', checkScopes(['devices']), async (req, res) => {
        const queryRes = await dev.getAllDevices();
        if (typeof queryRes.userMessage !== 'undefined') {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(queryRes.rows);
        }
    });

    // This middleware always at the end to catch undefined endpoints
    router.use('*', function(req, res) {
        res.status(404).send('Invalid endpoint');
    });

    return router;
};
