"use strict";
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const db = require('../src/db.js');
const usr = require('../src/user.js');
const dev = require('../src/device.js');

const router = express.Router();

function readDir(dirName) {
    return new Promise ((resolve, reject) => {
        fs.readdir(dirName, (dirError, dirData) => {
            if (dirError === null) {
                resolve(dirData);
            } else {
                reject(dirError);
            }
        });
    });
}

function readFile(fileName) {
    return new Promise ((resolve, reject) => {
        fs.readFile(fileName, 'utf8', (fileError, fileData) => {
            if (fileError === null) {
                resolve(fileData);
            } else {
                reject(fileError);
            }
        });
    });
}

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
                req.decodedToken = decoded;
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
        let staticLayerList = [];
        try {
            let allFiles = await readDir('./staticlayers/');
            // Sort filenames in alphabatical order
            allFiles.sort((a, b) => {
                return a < b ? -1 : 1;
            });
            for (let fileName of allFiles) {
                let fileNameParts = fileName.split('.');
                let fileExt = fileNameParts[fileNameParts.length - 1];
                if (fileNameParts.length > 1 && fileExt == 'geojson') {
                    let fileData = await readFile(`./staticlayers/${fileName}`);
                    staticLayerList.push(fileData);
                }
            }
            res.status(200).type('application/json').send(staticLayerList);
        } catch(err) {
            res.status(200).type('application/json').send([]);
        }
    });

    router.get('/positions', checkScopes(['positions']), async (req, res) => {
        let queryRes = db.getEmptyQueryRes();
        try {
            queryRes = await db.queryDbAsync('getLastPositions', [req.decodedToken.userId]);
        } catch(err) {
            // On error return the initial (empty) array
        }
        res.status(200).type('application/json').send(queryRes.rows);
    });

    // This middleware always at the end to catch undefined endpoints
    router.use('*', (req, res) => {
        res.status(404).send('Invalid endpoint');
    });

    return router;
};
