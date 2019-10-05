"use strict";
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const usr = require('../src/user.js');
const dev = require('../src/device.js');

const router = express.Router();

function checkScopes(scopes) {
    return (req, res, next) => {
        // Get the token from the header (API requests) or from the session (web client requests)
        let token = '';
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            token = req.headers.authorization.split(' ')[1];
        }
        if (req.isAuthenticated() && req.session && req.session.token) {
            token = req.session.token;
        }
        if (token !== '') {
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

module.exports = () => {
    router.get('/', (req, res) => {
        res.status(200).send('API is up');
    });

    router.get('/users', checkScopes(['users']), async (req, res) => {
        const queryRes = await usr.getAllUsers();
        if (typeof queryRes.userMessage !== 'undefined') {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(queryRes.rows);
        }
    });

    router.get('/users/:userId', checkScopes(['users']), async (req, res) => {
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

    router.get('/devices', checkScopes(['devices']), async (req, res) => {
        const queryRes = await dev.getAllDevices();
        if (typeof queryRes.userMessage !== 'undefined') {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(queryRes.rows);
        }
    });

    router.get('/staticlayers', checkScopes(['staticlayers']), async (req, res) => {
        fs.readdir('./staticlayers/', (err, allFiles) => {
            let fileNameParts = [], fileExt;
            if (err === null) {
                allFiles.sort((a, b) => {
                    return a < b ? -1 : 1;
                }).forEach((fileName) => {
                    fileNameParts = fileName.split('.');
                    fileExt = fileNameParts[fileNameParts.length - 1];
                    if (fileNameParts.length > 1 && fileExt == 'geojson') {
                        fs.readFile('./staticlayers/' + fileName, 'utf8', (fileError, fileData) => {
                            if (fileError === null) {
                                res.status(200).type('application/json').send(fileData);
                            }
                        });
                    }
                });
            }
        });
    });

    // This middleware always at the end to catch undefined endpoints
    router.use('*', (req, res) => {
        res.status(404).send('Invalid endpoint');
    });

    return router;
};
