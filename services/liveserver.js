"use strict";
const config = require('config');
const socketio = require('socket.io');
const cookieParser = require('cookie-parser');
const gp = require('./gpxplayer');
const db = require('../database/db');
const dev = require('../models/device');
const pos = require('../models/position');
const jwt = require('../auth/jwt');
const JSONValidator = require('../utils/validator');
const logger = require('../utils/logger');

const LivemapValidator = new JSONValidator('livemap');
var socketClients = [];

function getUserIdFromSession(sid) {
    return new Promise ((resolve, reject) => {
        db.getStore().get(sid, (error, session) => {
            if (session && session.passport && typeof session.passport.user !== 'undefined') {
                resolve(session.passport.user);
            } else {
                reject();
            }
        });
    });
}

//
// Exported modules
//

function start(server) {
    let io = socketio.listen(server, {cookie: false});

    // On every incoming socket get the ID of the current session. Used to access the user ID for authentication.
    io.use((socket, next) => {
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
        socket.token = req.signedCookies.access_token || req.cookies.access_token;
        next();
    });

    // On a new socket connection add the user ID to the socket
    io.sockets.on('connection', async (socket) => {
        try {
            // Request authentication from client
            socket.emit('authenticate');

            let userId = -1;
            // Extract user ID from token in cookie (preferred method)
            if (socket.token) {
                const payload = jwt.getTokenPayload(socket.token);
                if (payload.userId) {
                    userId = payload.userId;
                }
            }
            // Extract user ID from session ID in cookie (only if no valid or no token)
            if (userId < 0 && socket.sessionID) {
                userId = await getUserIdFromSession(socket.sessionID);
            }

            // On successful user ID extraction add user ID to socket
            if (userId >= 0) {
                socket.userId = userId;
                socketClients.push(socket);
                logger.info(`Client connected using cookie (${socketClients.length}): ${socket.userId}`);
                gp.startAll();
            }
        } catch(error) {
            // Ignore socket connections with unknown/invalid session ID
        }

        socket.on('disconnect', () => {
            socketClients.splice(socketClients.indexOf(socket), 1);
            // Remove disconnected sockets from list
            for (let i = 0; i < socketClients.length; i += 1) {
                if (socketClients[i].disconnected) {
                    socketClients.splice(i, 1);
                }
            }

        });

        socket.on('token', (data) => {
            const payload = jwt.getTokenPayload(data);
            // Token is valid if user ID is present 
            if (payload.userId) {
                socket.userId = payload.userId;
                socket.token = data;
                // Add socket to list but prevent duplicates (=same socket ID)
                let index = socketClients.map(function(x) { return x.id; }).indexOf(socket.id);
                if (index >= 0) {
                    socketClients[index] = socket;
                } else {
                    socketClients.push(socket);
                }
                logger.info(`Client connected using token (${socketClients.length}): ${socket.userId}`);
                gp.startAll();
            }
        });
    });
}

async function sendToClient(destData) {
    // On a valid location reception:
    // 1. Send a location update to every client that is authorized for this device
    // 2. Store the location in the database
    if (LivemapValidator.validate(destData)) {
        for (let i = 0; i < socketClients.length; i += 1) {
            let client = socketClients[i];
            if (client.userId && client.userId >= 0) {
                let queryRes = await dev.getAllowedDevices(client.userId);
                client.devices = [];
                for (let j = 0; j < queryRes.rows.length; j += 1) {
                    client.devices.push(queryRes.rows[j].device_id);
                    if (queryRes.rows[j].device_id === destData.device_id) {
                        client.emit('positionUpdate', JSON.stringify({type: 'gps', data: destData}));
                    }
                }
            }
        }
        await pos.insertPosition([destData.device_id, destData.device_id_tag, destData.loc_timestamp, destData.loc_lat, destData.loc_lon, destData.loc_type, destData.loc_attr]);
    } else {
        logger.info(`Invalid: ${LivemapValidator.errorsText()}`);
    }
}

module.exports.start = start;
module.exports.sendToClient = sendToClient;
