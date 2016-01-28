var qs = require('querystring');
var usr = require('./user.js');
var dev = require('./device.js');
var livesvr = require('./liveserver.js');

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

//
// Exported modules
//

function processLocation(request, response, type) {
    var form_data = '';
    var srcData = {};

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
                                    livesvr.sendToClient(destData);
                                });
                                break;
                            case 'geofancy':
                                processGeofancy(srcData, function (destData) {
                                    livesvr.sendToClient(destData);
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

module.exports.processLocation = processLocation;
