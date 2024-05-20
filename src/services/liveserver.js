import config from 'config';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import GpxPlayer from './gpxplayer.js';
import { getStore } from '../database/db.js';
import * as usr from '../models/user.js';
import * as dev from '../models/device.js';
import * as pos from '../models/position.js';
import { getTokenPayload } from '../auth/jwt.js';
import Logger from '../utils/logger.js';

const logger = Logger(import.meta.url);
const io = new Server();
let recentDeviceRooms = [];

const gpxPlayer = new GpxPlayer('./tracks/', '/location/gpx');

function getSessionInfo(sid) {
    return new Promise((resolve, reject) => {
        getStore().get(sid, (error, session) => {
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

function getRoomName(deviceId) {
    return `dev_${deviceId}`;
}

function joinRooms(socket, token) {
    return new Promise((resolve) => {
        const payload = getTokenPayload(token);
        // Token is valid if user ID is present
        if (payload && payload.userId) {
            socket.userId = payload.userId;
            socket.expiryTime = payload.iat; // Unix Timestamp in seconds
            dev.getAllowedDevices(socket.userId).then((queryRes) => {
                let devices = [];
                for (let j = 0; j < queryRes.rows.length; j += 1) {
                    devices.push(getRoomName(queryRes.rows[j].device_id));
                }
                socket.join(devices, () => {
                    //const rooms = Object.keys(socket.rooms);
                    //logger.debug(`Rooms: (${rooms})`);
                    resolve();
                });
            });
        }
        resolve();
    });
}

// Add a device room to one or more sockets (only if the room doesn't already exist)
function addRoom(sockets, device) {
    return new Promise((resolve) => {
        // Check if the device room already exists
        const deviceRoom = getRoomName(device.device_id);
        const roomExists = sockets.adapter.rooms.has(deviceRoom);

        // If the device room does't exist and we haven't seen this device before
        if (!roomExists && !recentDeviceRooms.includes(deviceRoom)) {
            // Save this device room so we don't have to check again
            recentDeviceRooms.push(deviceRoom);

            // Find out who is the owner of the device (based on the API key)
            usr.getUserByField('api_key', device.api_key).then((queryRes) => {
                // Add a new device room to every socket used by the owner
                for (let socket of sockets.sockets.values()) {
                    if (socket.userId === queryRes.rows[0].user_id) {
                        socket.join(getRoomName(device.device_id), () => {
                            resolve();
                        });
                    }
                }
            });
        } else {
            resolve();
        }
    });
}

async function startGpxPlayer(userId) {
    // Start tracks of own devices
    let queryRes = await usr.getUserByField('user_id', userId);
    if (queryRes.rows && queryRes.rows.length > 0) {
        gpxPlayer.addTracksByApiKey(queryRes.rows[0].api_key);
    }
    // Start tracks of shared devices
    queryRes = await dev.getAllowedDevices(userId);
    if (queryRes.rows && queryRes.rows.length > 0) {
        const deviceList = queryRes.rows.map((item) => ({
            identifier: item.identifier,
            api_key: item.api_key,
        }));
        gpxPlayer.addTracksByDevice(deviceList);
    }
    // Remove all tracks that stopped running
    gpxPlayer.cleanupTracks();
}

//
// Exported modules
//

export function start(server) {
    // On every incoming socket that contains a cookie get the ID of the current session.
    io.use((socket, next) => {
        // Only get the session ID if the socket contains a cookie
        if (socket.request.headers.cookie) {
            // Create the fake request that cookieParser will expect
            let req = {
                headers: {
                    cookie: socket.request.headers.cookie,
                },
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
                joinRooms(socket, sessionInfo.token).then(() => {
                    startGpxPlayer(socket.userId);
                });
            } else {
                // Authentication by token: request authentication token
                socket.emit('authenticate');
            }
        } catch (error) {
            // Ignore socket connections with unknown/invalid session ID
        }

        socket.on('token', (data) => {
            joinRooms(socket, data).then(() => {
                startGpxPlayer(socket.userId);
            });
        });
    });

    // Start Socket IO server
    io.listen(server, {
        cookie: false,
        cors: {
            origin: '*',
        },
    });
}

export function sendToClients(destData) {
    // Send a location update to every client that is authorized for this device
    // and store the location in the database
    let deviceRoom = getRoomName(destData.device_id);
    addRoom(io.sockets, destData)
        .then(() => {
            io.to(deviceRoom).emit(
                'positionUpdate',
                JSON.stringify({ type: 'gps', data: destData }),
            );
            logger.debug(`Clients connected: ${io.sockets.sockets.size}`);
            pos.insertPosition([
                destData.device_id,
                destData.device_id_tag,
                destData.loc_timestamp,
                destData.loc_lat,
                destData.loc_lon,
                destData.loc_type,
                destData.loc_attr,
            ]);
        })
        .catch((err) => {
            logger.error(`Send to clients: ${err.message}`);
        });
}
