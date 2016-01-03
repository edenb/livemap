var socket_host = location.hostname;
var socket_port = location.port;
var socket_protocol = location.protocol;
var socket_url = socket_protocol + '//' + socket_host + ':' + socket_port;
var socket;

var map, hash, devices = [], markerLayer;
var mapAttr = {};
var loc_type_str = {
    'rec': 'Recorded',
    'left': 'Last known'
};

function getLatLngFromString(device) {
    var lat = parseFloat(device.loc_lat), lon = parseFloat(device.loc_lon);
    return new L.latLng(lat, lon);
}

function getPopupText(dev) {
    var htmlText = '', PopupTime, PopupType;

    PopupTime = new Date(dev.loc_timestamp);
    PopupType = loc_type_str[dev.loc_type];

    htmlText += '<b>' + dev.alias + '</b>';
    if (typeof PopupType !== 'undefined') {
        htmlText += ' (' + PopupType + ')';
    }
    htmlText += '<br>';
    htmlText += PopupTime.toLocaleString() + '<br>';

    return htmlText;
}

function setMarkerOptions(marker) {
    var customIcon, customOpacity, dev,  cIcon, cPrefix, cMarkerColor, cIconColor, cSpin;

    // Default marker values
    dev = marker.device;
    customOpacity = 1.0;
    cIcon = 'home';
    cPrefix = 'fa';
    cMarkerColor = 'blue';
    cIconColor = 'white';
    cSpin = false;
    // Define icon color
    if (dev.loc_type === 'rec') {
        cIcon = 'circle';
        cMarkerColor = 'blue';
    }
    if ((dev.loc_type === 'now') || (dev.loc_type === 'left')) {
        cIcon = 'circle';
        cMarkerColor = 'green';
    }
    // Define icon opacity
    if (dev.loc_type === 'left') {
        customOpacity = 0.5;
    }

    customIcon = L.AwesomeMarkers.icon({icon: cIcon, prefix: cPrefix, markerColor: cMarkerColor, iconColor: cIconColor, spin: cSpin});
    marker.setIcon(customIcon);
    marker.setOpacity(customOpacity);
}

function getMarkerByDevice(device_id, callback) {
    markerLayer.eachLayer(function (marker) {
        if (marker.device.device_id === device_id) {
            callback(marker);
        } else {
            callback(null);
        }
    });
}

function createMarker(gps) {
    var marker;
    // Create a new marker
    marker = L.marker(getLatLngFromString(gps));
    // Add all device attributes to the marker
    marker.device = gps;
    marker.bindPopup(getPopupText(gps));
    setMarkerOptions(marker);
    // Add the marker to the layer
    markerLayer.addLayer(marker);
}

function moveMarker(gps) {
    getMarkerByDevice(gps.device_id, function (marker) {
        if (marker !== null) {
            marker.setLatLng(getLatLngFromString(gps));
            marker.device = gps;
            marker.setPopupContent(getPopupText(gps));
            setMarkerOptions(marker);
        }
    });
}

function clearAllMarkers() {
    markerLayer.clearLayers();
}

function updateDevice(gps) {
    var i, j, checkedDevices;
    // Check if the device is already on the map
    i = 0;
    while ((i < devices.length) && (devices[i].device_id !== gps.device_id)) {
        i++;
    }
    if (i !== devices.length) { // Device already on the map -> devices[i]
        moveMarker(gps);
        checkedDevices = $('#table-locations').bootstrapTable('getAllSelections');
        j = 0;
        while ((j < checkedDevices.length) && (checkedDevices[j].device_id !== gps.device_id)) {
            j++;
        }
        if (j !== checkedDevices.length) {
            gps.state = true;
        }
        $('#table-locations').bootstrapTable('updateByUniqueId', {id: gps.device_id, row: gps});
        devices[i] = gps;
    } else { // New device
        createMarker(gps);
        $('#table-locations').bootstrapTable('append', gps);
        devices.push(gps);
    }
}

function initMap() {
    var mapCookie;
    // Create a map in the "livemap" div
    map = L.map('livemap');
    // Set the view port to the last view (from a cookie) or set a default view
    mapCookie = docCookies.getItem('map');
    if (mapCookie === null) {
        mapAttr.center = L.latLng(52.0, 5.0);
        mapAttr.zoom = 10;
    } else {
        mapAttr = JSON.parse(mapCookie);
    }
    map.setView(mapAttr.center, mapAttr.zoom);
    // Add an OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    // Add hash with zoom level and coordinates to URL
    hash = new L.Hash(map);
    map.on('moveend', onMapChange);
    // Add a layer to show the locations of the devices
    markerLayer = new L.FeatureGroup();
    // Add a control to select layers
    L.control.layers({}, {'Devices': markerLayer}).addTo(map);
}

function onMapChange() {
    mapAttr.center = map.getCenter();
    mapAttr.zoom = map.getZoom();
    docCookies.setItem('map', JSON.stringify(mapAttr));
}

function initSocket() {
    socket = io.connect(socket_url);

    socket.on('loginSuccess', function (obj) {
        socket.emit('getLastPositions');
        //socket.emit('startPosStream');
        socket.emit('startGpxPlayer');
    });

    socket.on('lastPositions', function (lpositions) {
        var i;
        clearAllMarkers();
        devices = lpositions;
        for (i = 0; i < devices.length; i += 1) {
            if (devices[i].loc_lat !== 0 && devices[i].loc_lon !== 0) {
                createMarker(devices[i]);
            }
        }
        $('#table-locations').bootstrapTable('load', devices);
        // Add the marker layer to the map
        map.addLayer(markerLayer);
        // Zoom to marker boundaries if any markers defined
        if (markerLayer.getLayers().length > 0 && mapAttr === null) {
            map.fitBounds(markerLayer.getBounds());
        }
    });

    socket.on('positionUpdate', function (d) {
        var parsedObj = JSON.parse(d);
        if (parsedObj.type === 'gps') {
            updateDevice(parsedObj.data);
        }
    });
}

$(document).ready(function () {
    initMap();
    initSocket();
});
