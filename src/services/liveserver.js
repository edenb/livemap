import config from 'config';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import GpxPlayer from './gpxplayer.js';
import { getStore } from '../database/db.js';
import * as dev from '../models/device.js';
import * as usr from '../models/user.js';
import { getTokenPayload } from '../auth/jwt.js';
import Logger from '../utils/logger.js';

const logger = Logger(import.meta.url);
const io = new Server();

const gpxPlayer = new GpxPlayer('/location/gpx');

function getSessionInfo(sid) {
    return new Promise((resolve, reject) => {
        getStore().get(sid, (_, session) => {
            if (session && session.passport && session.passport.user) {
                let sessionInfo = {};
                sessionInfo.userId = session.passport.user;
                sessionInfo.token = session.token;
                resolve(sessionInfo);
            } else {
                reject('No session found.');
            }
        });
    });
}

function getRoomName(deviceId) {
    return `dev_${deviceId}`;
}

async function joinRooms(socket, token) {
    const payload = getTokenPayload(token);
    // Token is valid if user ID is present
    if (payload && payload.userId) {
        socket.userId = payload.userId;
        socket.expiryTime = payload.iat; // Unix Timestamp in seconds
        const { rows } = await dev.getAllowedDevices(socket.userId);
        const deviceRooms = rows.map(({ device_id }) => getRoomName(device_id));
        await socket.join(deviceRooms);
    } else {
        throw new Error('Unable to join rooms. User token invalid.');
    }
}

async function startGpxPlayer(userId) {
    // Create al list of all available gpx files
    await gpxPlayer.createFileList('./tracks/');
    // Start tracks of own devices
    // ToDo: probably remove this because allowed devices also includes own devices
    const { rows } = await usr.getUserByField('user_id', userId);
    if (rows.length > 0) {
        gpxPlayer.addTracksByApiKey(rows[0].api_key);
    }
    // Start tracks of shared devices
    const { rows: devices } = await dev.getAllowedDevices(userId);
    if (devices.length > 0) {
        const deviceList = devices.map((device) => ({
            identifier: device.identifier,
            api_key: device.api_key,
        }));
        gpxPlayer.addTracksByDevice(deviceList);
    }
    // Remove all tracks that stopped running
    gpxPlayer.cleanupTracks();
}

//
// Exported modules
//

// The liverserver (Socket.IO server) supports 3 ways of authorization:
// 1. Cookie authorization
//    Reuse of the cookie provided by the REST API.
//    After successful login with the REST API the server sends a cookie with the name connect.sid.
//    During socket.io connection setup the liveserver checks the existence and validity of the connect-sid cookie.
// 2. Token authorization by handshake
//    After successful login with the REST API the server provides a token.
//    During socket.io connection setup (handshake) the client sends the given token to the server.
//    The server checks the validity of the token.
// 3. Token authorization by event
//    After successful login with the REST API the server provides a token.
//    After socket.io connection setup the liveserver asks for a token (token event).
//    The client sends the token in an event (authenticate event).
//    The server checks the validity of the token.
export function start(server) {
    // On every incoming socket that contains a cookie get the ID of the current session.
    io.use(async (socket, next) => {
        let err;
        const token = socket.handshake.auth.token;
        if (token) {
            try {
                await joinRooms(socket, token);
                await startGpxPlayer(socket.userId);
            } catch (error) {
                err = Error(`Unauthorized. ${error.message}`);
            }
        }
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
        next(err);
    });

    // On a new socket connection handle socket authentication and join appropriate rooms
    io.sockets.on('connection', async (socket) => {
        socket.on('token', async (data) => {
            try {
                await joinRooms(socket, data);
                await startGpxPlayer(socket.userId);
                socket.emit('authorized');
            } catch (error) {
                socket.emit('unauthorized');
            }
        });

        // Authentication by cookie: the user joins all device rooms it has access to
        if (socket.sessionID) {
            try {
                let sessionInfo = await getSessionInfo(socket.sessionID);
                await joinRooms(socket, sessionInfo.token);
                await startGpxPlayer(socket.userId);
                socket.emit('authorized');
            } catch (error) {
                socket.emit('unauthorized');
            }
        } else {
            // Authentication by token: request authentication token
            socket.emit('authenticate');
        }
    });

    // Start Socket IO server
    io.listen(server, {
        cookie: false,
        cors: {
            origin: '*',
        },
    });
    return io;
}

export async function sendToClients(destData) {
    // Send a location update to every client that is authorized for this device
    let deviceRoom = getRoomName(destData.device_id);
    io.to(deviceRoom).emit(
        'positionUpdate',
        JSON.stringify({ type: 'gps', data: destData }),
    );
    logger.debug(`Clients connected: ${io.sockets.sockets.size}`);
}
