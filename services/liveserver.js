"use strict";
const config = require('config');
const socketio = require('socket.io');
const cookieParser = require('cookie-parser');
const gp = require('./gpxplayer');
const db = require('../database/db');
const usr = require('../models/user');
const dev = require('../models/device');
const pos = require('../models/position');
const jwt = require('../auth/jwt');
const JSONValidator = require('../utils/validator');
const logger = require('../utils/logger');

const LivemapValidator = new JSONValidator('livemap');
let io;

function getSessionInfo(sid) {
    return new Promise ((resolve, reject) => {
        db.getStore().get(sid, (error, session) => {
            if (session && session.passport && session.passport.user) {
                let sessionInfo = {};
                sessionInfo.userId = session.passport.user;
                sessionInfo.token = session.token;
                resolve(sessionInfo);
            } else {
                reject();
            }
        });
    });
}

async function joinRooms(socket, token) {
    const payload = jwt.getTokenPayload(token);
    // Token is valid if user ID is present 
    if (payload.userId) {
        socket.userId = payload.userId;
        socket.expiryTime = payload.iat; // Unix Timestamp in seconds
        let queryRes = await dev.getAllowedDevices(socket.userId);
        let devices = [];
        for (let j = 0; j < queryRes.rows.length; j += 1) {
            devices.push(`dev_${queryRes.rows[j].device_id}`);
        }
        socket.join(devices, () => {
            const rooms = Object.keys(socket.rooms);
            logger.debug(`Rooms: (${rooms})`);
        });
    }
}

async function startGpxPlayer(userId) {
    let queryRes = await usr.getUserByField('user_id', userId);
    if (queryRes.rows && queryRes.rows.length > 0) {
        gp.startAll(queryRes.rows[0].api_key);
    }
}

//
// Exported modules
//

function start(server) {
    io = socketio.listen(server, {cookie: false});

    // On every incoming socket that contains a cookie get the ID of the current session.
    io.use((socket, next) => {
        // Only get the session ID if the socket contains a cookie
        if (socket.request.headers.cookie)
        {
            // Create the fake request that cookieParser will expect
            let req = {
                "headers": {
                "cookie": socket.request.headers.cookie
                }
            };
            // Run the parser and store the sessionID
            cookieParser(config.get('sessions.secret'))(req, null, () => {});
            let name = config.get('sessions.name');
            socket.sessionID = req.signedCookies[name] || req.cookies[name];
        }
        next();
    });

    // On a new socket connection handle socket authentication and join appropriate rooms
    io.sockets.on('connection', async (socket) => {
        try {
            // Authentication by cookie: the user joins all device rooms it has access to
            if (socket.sessionID) {
                let sessionInfo = await getSessionInfo(socket.sessionID);
                joinRooms(socket, sessionInfo.token);
                startGpxPlayer(socket.userId);
            } else {
                // Authentication by token: request authentication token
                socket.emit('authenticate');
            }
        } catch(error) {
            // Ignore socket connections with unknown/invalid session ID
        }

        socket.on('token', async (data) => {
            joinRooms(socket, data);
            startGpxPlayer(socket.userId);
        });
    });
}

async function sendToClients(destData) {
    // On a valid location reception:
    // 1. Send a location update to every client that is authorized for this device
    // 2. Store the location in the database
    if (LivemapValidator.validate(destData)) {
        // Send location to room
        let deviceRoom = `dev_${destData.device_id}`;
        io.to(deviceRoom).emit('positionUpdate', JSON.stringify({type: 'gps', data: destData}));
        logger.debug(`Clients connected: ${Object.keys(io.sockets.connected).length}`);
        await pos.insertPosition([destData.device_id, destData.device_id_tag, destData.loc_timestamp, destData.loc_lat, destData.loc_lon, destData.loc_type, destData.loc_attr]);
    } else {
        logger.info(`Invalid: ${LivemapValidator.errorsText()}`);
    }
}

module.exports.start = start;
module.exports.sendToClients = sendToClients;
