var config = require('config');
var qs = require('querystring');
var io = require('socket.io');
var cookieParser = require('cookie-parser');
var gp = require('./gpxplayer.js');
var db = require('./db.js');
var usr = require('./user.js');
var dev = require('./device.js');

var socketClients = [];

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

function isGpsDataValid(gpsData) {
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
        console.log('Invalid location: ' + qs.stringify(gpsData));
    }
    return isValid;
}

function isAllowed(devices_array, device) {
    return devices_array.indexOf(device) > -1;
}

function processGpx(srcData, callback) {
    var destData = {}, identObj;

    identObj = dev.splitDeviceIdentity(srcData.device_id, '_');
    if ((identObj.err === null) && usr.isKnownAPIkey(identObj.apiKey, null)) {
        dev.getDeviceByIdentity(identObj.apiKey, identObj.identifier, function(destDevice) {    // Todo: check device_id existance
            if (destDevice !== null) {
                destData.device_id = destDevice.device_id;
                destData.identifier = destDevice.identifier;
                destData.alias = destDevice.alias;
                destData.device_id_tag = null;
                destData.api_key_tag = null;
                destData.identifier_tag = null;
                destData.loc_timestamp = srcData.gps_time;
                destData.loc_lat = srcData.gps_latitude;
                destData.loc_lon = srcData.gps_longitude;
                destData.loc_type = 'rec';
                destData.loc_attr = null;
            }
            return callback(destData);
        });
    } else {
        return callback(destData);
    }
}

// Geofancy
// device: uuid of the device Geofancy is running on (xxxxxxxx-xxxx-xxxx-...)
// id: name of the iBeacon or geofence (should be set in Geofancy)
// latitude: center of the geofence or zero if iBeacon found
// longitude: center of the geofence or zero if iBeacon found
// timestamp: date/time in seconds after 1970
// trigger: exit, enter or test
// identity geofence - id:device
// identity iBeacon - id1:device  id1:id2
function processGeofancy(srcData, callback) {
    var destData = {}, identity, identObj;

    // Determine if it's a detection of an iBeacon (lon and lat are '0') or the location of a device
    if (srcData.latitude === '0' && srcData.longitude === '0') {
        identObj = dev.splitDeviceIdentity(srcData.id, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            dev.getDeviceByIdentity(identObj.apiKey, srcData.device, function(destDevice) {    // Todo: check device_id existance
                if (destDevice !== null) {
                    destData.device_id = destDevice.device_id;
                    destData.loc_timestamp = new Date(srcData.timestamp * 1000).toUTCString();
                    dev.getDeviceByIdentity(identObj.apiKey, identObj.identifier, function(destDevice) {    // Todo: check id existance
                        if (destDevice !== null) {
                            destData.device_id_tag = destDevice.device_id;
                            destData.alias = destDevice.alias;
                            destData.loc_lat = destDevice.fixed_loc_lat.toString();
                            destData.loc_lon = destDevice.fixed_loc_lon.toString();
                            destData.loc_attr = null;
                            destData.loc_type = null;
                            if ((srcData.trigger === 'enter') || (srcData.trigger === 'test')) {
                                destData.loc_type = 'now';
                            }
                            if (srcData.trigger === 'exit') {
                                destData.loc_type = 'left';
                            }
                            return callback(destData);
                        } else {
                            destData = {};
                            return callback(destData);
                        }
                    });
                } else {
                    return callback(destData);
                }
            });
        } else {
            return callback(destData);
        }
    } else {
        identity = srcData.id + ':' + srcData.device;
        identObj = dev.splitDeviceIdentity(identity, ':');
        if (identObj.err === null && usr.isKnownAPIkey(identObj.apiKey, null)) {
            dev.getDeviceByIdentity(identObj.apiKey, srcData.device, function (destDevice) {
                if (destDevice !== null) {
                    destData.device_id = destDevice.device_id;
                    destData.device_id_tag = null;
                    destData.alias = destDevice.alias;
                    destData.loc_timestamp = new Date(srcData.timestamp * 1000).toUTCString();
                    destData.loc_lat = srcData.latitude;
                    destData.loc_lon = srcData.longitude;
                    destData.loc_attr = null;
                    destData.loc_type = null;
                    if ((srcData.trigger === 'enter') || (srcData.trigger === 'test')) {
                        destData.loc_type = 'now';
                    }
                    if (srcData.trigger === 'exit') {
                        destData.loc_type = 'left';
                    }
                    return callback(destData);
                } else {
                    return callback(destData);
                }
            });
        } else {
            return callback(destData);
        }
    }
}

function send2client(destData) {
    // On a valid location reception:
    // 1. Store the location in the database
    // 2. Send a location update to every client that is authorized for this device
    if (isGpsDataValid(destData)) {
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

function processLocation(request, response, type) {
    var form_data = '';
    var i, srcData = {}, destData = {};

    request.on('data', function (chunk) {
        form_data += chunk.toString();
    });

    request.on('end', function () {
        srcData = qs.parse(form_data);
        dev.loadDevicesFromDB(function (err) {
            if (err === null) {
                usr.loadUsersFromDB(function (err) {
                    if (err === null) {
                        switch (type) {
                            case 'gpx':
                                processGpx(srcData, function (destData) {
                                    send2client(destData);
                                });
                                break;
                            case 'geofancy':
                                processGeofancy(srcData, function (destData) {
                                    send2client(destData);
                                });
                                break;
                        }
                    }
                });
            }
        });
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.write('OK');
        response.end();
    });
}

module.exports.start = start;
module.exports.processLocation = processLocation;
