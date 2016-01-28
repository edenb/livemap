var config = require('config');
var io = require('socket.io');
var cookieParser = require('cookie-parser');
var gp = require('./gpxplayer.js');
var db = require('./db.js');
var usr = require('./user.js');

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
        console.log('Invalid location: ' + JSON.stringify(gpsData));
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
    io.sockets.on('connection', function (socket) {
        db.queryDb('findSessionById', [socket.sessionID], function (err, rows, result) {
            if (err === null && (typeof rows[0] !== 'undefined')) {
                if (typeof rows[0].sess.passport.user !== 'undefined') {
                    usr.findUser('id', rows[0].sess.passport.user, function (err, user) {
                        socket.user = user;
                        socketClients.push(socket);
                        console.log('Client connected (' + socketClients.length + '): ' + socket.user.fullname);
                        socket.emit('loginSuccess', {numClients: socketClients.length, fullName: socket.user.fullname});
                    });
                }
            }
        });

        socket.on('startPosStream', function () {
            var i;
            if (typeof socket.user.username !== 'undefined' && socket.user.username !== null) {
                db.queryDb('getAllowedDevices', [socket.user.user_id], function (err, rows, result) {
                    if (err === null && rows !== null) {
                        socket.devices = [];
                        for (i = 0; i < rows.length; i += 1) {
                            socket.devices.push(rows[i].device_id);
                        }
                    }
                });
            }
        });

        socket.on('getLastPositions', function () {
            if (typeof socket.user.username !== 'undefined' && socket.user.username !== null) {
                db.queryDb('getLastPositions', [socket.user.user_id], function (err, rows, result) {
                    if (err === null && rows !== null) {
                        socket.emit('lastPositions', rows);
                    }
                });
            }
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

function sendToClient(destData) {
    // On a valid location reception:
    // 1. Store the location in the database
    // 2. Send a location update to every client that is authorized for this device
    if (isInputDataValid(destData)) {
        for (i = 0; i < socketClients.length; i += 1) {
            var client = socketClients[i];
            if (typeof client.user.username !== 'undefined' && client.user.username !== null) {
                db.queryDb('getAllowedDevices', [client.user.user_id], function (err, rows, result) {
                    if (err === null && rows !== null) {
                        client.devices = [];
                        for (i = 0; i < rows.length; i += 1) {
                            client.devices.push(rows[i].device_id);
                            if (rows[i].device_id === destData.device_id) {
                                client.emit('positionUpdate', JSON.stringify({ type: 'gps', data: destData}));
                            }
                        }
                    }
                });
            }
        }
        db.queryDb('insertPosition', [destData.device_id, destData.device_id_tag, destData.loc_timestamp, destData.loc_lat, destData.loc_lon, destData.loc_type, destData.loc_attr], function (){});
    }
}

module.exports.start = start;
module.exports.sendToClient = sendToClient;
