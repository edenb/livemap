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
        const queryRes = await dev.getAllowedDevices(socket.userId);
        const deviceRooms = queryRes.rows.map(({ device_id }) =>
            getRoomName(device_id),
        );
        await socket.join(deviceRooms);
    } else {
        throw new Error('Unable to join rooms. User token invalid.');
    }
}

async function startGpxPlayer(userId) {
    // Create al list of all available gpx files
    await gpxPlayer.createFileList('./tracks/');
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
    // and store the location in the database
    let deviceRoom = getRoomName(destData.device_id);
    io.to(deviceRoom).emit(
        'positionUpdate',
        JSON.stringify({ type: 'gps', data: destData }),
    );
    logger.debug(`Clients connected: ${io.sockets.sockets.size}`);
    await pos.insertPosition([
        destData.device_id,
        destData.device_id_tag,
        destData.loc_timestamp,
        destData.loc_lat,
        destData.loc_lon,
        destData.loc_type,
        destData.loc_attr,
    ]);
}
