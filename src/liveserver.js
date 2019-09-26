"use strict";
var config = require('config');
var io = require('socket.io');
var cookieParser = require('cookie-parser');
var fs = require('fs');
var gp = require('./gpxplayer.js');
var db = require('./db.js');
var usr = require('./user.js');
var logger = require('./logger.js');

var socketClients = [];

function isInputDataValid(gpsData) {
    var isValid = true;
    // Check device id
    //if (typeof gpsData.device_id !== 'undefined') {
    //    if (gpsData.device_id.length < 6 || gpsData.device_id.length > 100) {
    //        isValid = false;
    //    }
    //} else {
    //    isValid = false;
    //}
    // Check latitude (allowed: null, -90 < lat < 90)
    if (typeof gpsData.loc_lat !== 'undefined') {
        if (gpsData.loc_lat !== null) {
            if (gpsData.loc_lat.trim() === '' || +gpsData.loc_lat < -90.0 || +gpsData.loc_lat > 90.0 || isNaN(+gpsData.loc_lat)) {
                isValid = false;
            }
        }
    } else {
        isValid = false;
    }
    // Check longitude (allowed: null, -180 < lon < 180)
    if (typeof gpsData.loc_lon !== 'undefined') {
        if (gpsData.loc_lon !== null) {
            if (gpsData.loc_lon.trim() === '' || +gpsData.loc_lon < -180.0 || +gpsData.loc_lon > 180.0 || isNaN(+gpsData.loc_lon)) {
                isValid = false;
            }
        }
    } else {
        isValid = false;
    }
    // Check time
    if (typeof gpsData.loc_timestamp !== 'undefined' && gpsData.loc_timestamp !== '') {
        if (isNaN(Date.parse(gpsData.loc_timestamp))) {
            isValid = false;
        }
    } else {
        isValid = false;
    }

    if (!isValid) {
        logger.info('Invalid location: ' + JSON.stringify(gpsData));
    }
    return isValid;
}

//
// Exported modules
//

function start(server) {
    io = io.listen(server);

    // On every incoming socket get the ID of the current session. Used to access user information for authentication.
    io.use(function ioSession(socket, next) {
        // Create the fake request that cookieParser will expect
        var req = {
            "headers": {
                "cookie": socket.request.headers.cookie
            }
        };
        // Run the parser and store the sessionID
        cookieParser(config.get('sessions.secret'))(req, null, function () {});
        var name = config.get('sessions.name');
        socket.sessionID = req.signedCookies[name] || req.cookies[name];
        next();
    });

    // On a new socket connection add the user information to the socket
    io.sockets.on('connection', async (socket) => {
        let queryRes1;
        try {
            queryRes1 = await db.queryDbAsync('findSessionById', [socket.sessionID]);
        } catch(err) {
            logger.error(`Unable to connect a socket.`);
        }
        if (queryRes1.rowCount !== 0 && typeof queryRes1.rows[0].sess.passport.user !== 'undefined') {
            const queryRes2 = await usr.getUserByField('user_id', queryRes1.rows[0].sess.passport.user);
            if (queryRes2.rowCount !== 0) {
                socket.user = queryRes2.rows[0];
                socketClients.push(socket);
                logger.info(`Client connected (${socketClients.length}): ${socket.user.fullname}`);
                socket.emit('loginSuccess', {numClients: socketClients.length, fullName: socket.user.fullname});
            }
        }

//        socket.on('startPosStream', async () => {
//            let queryRes;
//            if (typeof socket.user.username !== 'undefined' && socket.user.username !== null) {
//                try {
//                    queryRes = await db.queryDbAsync('getAllowedDevices', [socket.user.user_id]);
//                } catch(err) {
//                    logger.error(`Unable to start a socket stream.`);
//                }
//                socket.devices = [];
//                for (let i = 0; i < queryRes.rowCount; i += 1) {
//                    socket.devices.push(queryRes.rows[i].device_id);
//                }
//            }
//        });

        socket.on('getLastPositions', async function () {
            if (typeof socket.user.username !== 'undefined' && socket.user.username !== null) {
                let queryRes;
                try {
                    queryRes = await db.queryDbAsync('getLastPositions', [socket.user.user_id]);
                } catch(err) {
                    logger.error(`Unable to send last positions.`);
                }
                socket.emit('lastPositions', queryRes.rows);
            }
        });

        socket.on('getStaticLayers', function () {
            fs.readdir('./staticlayers/', function (err, allFiles) {
                var fileNameParts = [], fileExt;
                if (err === null) {
                    allFiles.sort(function(a, b) {
                        return a < b ? -1 : 1;
                    }).forEach(function(fileName, key) {
                        fileNameParts = fileName.split('.');
                        fileExt = fileNameParts[fileNameParts.length - 1];
                        if (fileNameParts.length > 1 && fileExt == 'geojson') {
                            fs.readFile('./staticlayers/' + fileName, 'utf8', function (fileError, fileData) {
                                if (fileError === null) {
                                    socket.emit('staticLayers', fileData);
                                }
                            });
                        }
                    });
                }
            });
        });

        socket.on('startGpxPlayer', function () {
            if (typeof socket.user.username !== 'undefined' && socket.user.username !== null) {
                gp.startAll();
            }
        });

        socket.on('disconnect', function () {
            socketClients.splice(socketClients.indexOf(socket), 1);
        });
    });
}

async function sendToClient(destData) {
    // On a valid location reception:
    // 1. Store the location in the database
    // 2. Send a location update to every client that is authorized for this device
    if (isInputDataValid(destData)) {
        for (let i = 0; i < socketClients.length; i += 1) {
            let client = socketClients[i];
            if (typeof client.user.username !== 'undefined' && client.user.username !== null) {
                let queryRes;
                try {
                    queryRes = await db.queryDbAsync('getAllowedDevices', [client.user.user_id]);
                } catch(err) {
                    logger.error(`Unable to get allowed devices. ${err.message}`);
                }
                client.devices = [];
                for (let j = 0; j < queryRes.rows.length; j += 1) {
                    client.devices.push(queryRes.rows[j].device_id);
                    if (queryRes.rows[j].device_id === destData.device_id) {
                        client.emit('positionUpdate', JSON.stringify({type: 'gps', data: destData}));
                    }
                }
            }
        }
        try {
            await db.queryDbAsync('insertPosition', [destData.device_id, destData.device_id_tag, destData.loc_timestamp, destData.loc_lat, destData.loc_lon, destData.loc_type, destData.loc_attr]);
        } catch(err) {
            logger.error(`Unable to store position.`);
        }
    }
}

module.exports.start = start;
module.exports.sendToClient = sendToClient;
