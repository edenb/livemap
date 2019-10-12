"use strict";
const express = require('express');
const fs = require('fs');
const jwt = require('../auth/jwt');
const db = require('../database/db');
const usr = require('../models/user');
const dev = require('../models/device');

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

module.exports = () => {
    router.get('/', (req, res) => {
        res.status(200).send('API is up');
    });

    router.get('/users', jwt.checkScopes(['users']), async (req, res) => {
        const queryRes = await usr.getAllUsers();
        if (typeof queryRes.userMessage !== 'undefined') {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(queryRes.rows);
        }
    });

    router.get('/users/:userId', jwt.checkScopes(['users']), async (req, res) => {
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

    router.get('/devices', jwt.checkScopes(['devices']), async (req, res) => {
        const queryRes = await dev.getAllDevices();
        if (typeof queryRes.userMessage !== 'undefined') {
            res.status(500).send(`Internal Server Error`);
        } else {
            res.status(200).send(queryRes.rows);
        }
    });

    router.get('/staticlayers', jwt.checkScopes(['staticlayers']), async (req, res) => {
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
                    staticLayerList.push(JSON.parse(fileData));
                }
            }
            res.status(200).type('application/json').send(staticLayerList);
        } catch(err) {
            res.status(200).type('application/json').send([]);
        }
    });

    router.get('/positions', jwt.checkScopes(['positions']), async (req, res) => {
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
