var socket_host = location.hostname;
var socket_port = location.port;
var socket_protocol = location.protocol;
var socket_url = socket_protocol + '//' + socket_host + ':' + socket_port;
var socket;

var map, devices = [], markerLayer, overlayList = [], controlLayerSwitch = {};
var mapAttr = {};
var loc_type_str = {
    'rec': 'Recorded',
    'left': 'Last known'
};

function getLatLngFromString(device) {
    return new L.latLng(device.loc_lat, device.loc_lon);
}

function getPopupText(dev) {
    var htmlText = '', PopupTime, PopupType;

    PopupTime = new Date(dev.loc_timestamp);
    // If loc_type is defined use predefined label
    if (dev.loc_type) {
        PopupType = loc_type_str[dev.loc_type];

        htmlText += '<b>' + dev.alias + '</b>';
        if (typeof PopupType !== 'undefined') {
            htmlText += ' (' + PopupType + ')';
        }
        htmlText += '<br>';
        htmlText += PopupTime.toLocaleString() + '<br>';
    } else {
        if (dev.loc_attr) {
            if (dev.loc_attr.labelshowalias) {
                htmlText += '<b>' + dev.alias + '</b><br>';
            }
            if (dev.loc_attr.labelshowtime) {
                htmlText += PopupTime.toLocaleString() + '<br>';
            }
            if (dev.loc_attr.labelcustomhtml) {
                htmlText += dev.loc_attr.labelcustomhtml;
            }
        }
    }

    if (htmlText === '') {
        // Show at least the alias
        htmlText = '<b>' + dev.alias + '</b>';
    }

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

    // If loc_type is defined use predefined marker/icon sets
    if (dev.loc_type) {
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
    } else {
        if (dev.loc_attr) {
            if (dev.loc_attr.miconname) {
                cIcon = dev.loc_attr.miconname;
            }
            if (dev.loc_attr.miconlib) {
                cPrefix = dev.loc_attr.miconlib;
            }
            if (dev.loc_attr.mcolor) {
                cMarkerColor = dev.loc_attr.mcolor;
            }
            if (dev.loc_attr.miconcolor) {
                cIconColor = dev.loc_attr.miconcolor;
            }
            if (dev.loc_attr.mopacity) {
                customOpacity = dev.loc_attr.mopacity;
            }
        }
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

function sortOverlays(layerA, layerB, nameA, nameB) {
	nameA = nameA.toUpperCase(); // ignore upper and lowercase
	nameB = nameB.toUpperCase(); // ignore upper and lowercase
	if (nameA < nameB || nameA == 'DEVICES') {
		return -1;
	}
	if (nameA > nameB || nameB == 'DEVICES') {
		return 1;
	}
	// names must be equal
	return 0;
}

function initMap() {
    var mapCookie;
    // Create a map in the "livemap" div
    map = L.map('livemap');
    // Set the view port to the last view (from a cookie) or set a default view
    mapCookie = docCookies.getItem('map');
    if (mapCookie === null) {
        mapAttr.center = L.latLng(40.0, -40.0);
        mapAttr.zoom = 3;
    } else {
        mapAttr = JSON.parse(mapCookie);
    }
    map.setView(mapAttr.center, mapAttr.zoom);
    // Add an OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    // Add hash with zoom level and coordinates to URL
    new L.Hash(map);
    map.on('moveend', onMapChange);
    // Add a layer to show the locations of the devices
    markerLayer = new L.FeatureGroup();
    // Add a control to select layers
    controlLayerSwitch = L.control.layers({}, {'Devices': markerLayer}, {collapsed: false, sortLayers: true, sortFunction: sortOverlays}).addTo(map);
}

function onMapChange() {
    mapAttr.center = map.getCenter();
    mapAttr.zoom = map.getZoom();
    docCookies.setItem('map', JSON.stringify(mapAttr));
}

function initSocket() {
    socket = io.connect(socket_url);

    socket.on('positionUpdate', function (d) {
        var parsedObj = JSON.parse(d);
        if (parsedObj.type === 'gps') {
            updateDevice(parsedObj.data);
        }
    });
}

function getLastPositionsData(callback) {
    var url = "/api/v1/positions";
    $.ajax({
        url: url,
        method: "GET"
    }).done((lastPositionsData) => {
        callback(lastPositionsData);
    }).fail(() => {
        callback([]);
    });
}

function loadLastPositions() {
    getLastPositionsData((lastPositionData) => {
        clearAllMarkers();
        devices = lastPositionData;
        for (let i = 0; i < devices.length; i += 1) {
            if (devices[i].loc_lat !== 0 && devices[i].loc_lon !== 0) {
                createMarker(devices[i]);
            }
        }
        $('#table-locations').bootstrapTable('load', devices);
        // Add the marker layer to the map
        map.addLayer(markerLayer);
        // Zoom to marker boundaries if any markers defined
        if (markerLayer.getLayers().length > 0 && docCookies.getItem('map') === null) {
            map.fitBounds(markerLayer.getBounds());
        }
    });
}

function getStaticLayerData(callback) {
    var url = "/api/v1/staticlayers";
    $.ajax({
        url: url,
        method: "GET"
    }).done((staticLayerData) => {
        callback(staticLayerData);
    }).fail(() => {
        callback([]);
    });
}

function loadStaticLayers() {
    getStaticLayerData((staticLayerList) => {
        for (let staticLayerData of staticLayerList) {
            let staticLayer = L.geoJson(staticLayerData, {
                pointToLayer: (feature, latlng) => {
                    let staticMarker = L.marker(latlng, {zIndexOffset:-1000});
                    let customIcon = L.AwesomeMarkers.icon({icon: (staticLayerData.properties && staticLayerData.properties.marker && staticLayerData.properties.marker.icon) || 'star',
                                                            prefix: (staticLayerData.properties && staticLayerData.properties.marker && staticLayerData.properties.marker.prefix) || 'fa',
                                                            markerColor: (staticLayerData.properties && staticLayerData.properties.marker && staticLayerData.properties.marker.markercolor) || 'green',
                                                            iconColor: (staticLayerData.properties && staticLayerData.properties.marker && staticLayerData.properties.marker.iconcolor) || 'white',
                                                            spin: (staticLayerData.properties && staticLayerData.properties.marker && staticLayerData.properties.marker.spin) || false});
                    staticMarker.setIcon(customIcon);
                    staticMarker.setOpacity((staticLayerData.properties && staticLayerData.properties.marker && staticLayerData.properties.marker.opacity) || 0.8);
                    return staticMarker;
                },
                style: (feature) => {
                    // Only apply style to (multi)lines and polygons
                    if (feature.geometry.type !== 'Point') {
                        var customStyle = {color: (staticLayerData.properties && staticLayerData.properties.line && staticLayerData.properties.line.color) || 'red', //'#ff7800',
                                        weight: (staticLayerData.properties && staticLayerData.properties.line && staticLayerData.properties.line.weight) || 5,
                                        opacity: (staticLayerData.properties && staticLayerData.properties.line && staticLayerData.properties.line.opacity) || 0.65};
                        return customStyle;
                    } else {
                        return {};
                    }
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.popup) {
                        layer.bindPopup(feature.properties.popup);
                    }
                }
            });

            let oName = (staticLayerData.properties && staticLayerData.properties.name) || 'Overlay';
            let oChecked = false;
            // If the received overlay is already in the list than remove the previous one first
            if (typeof overlayList[oName] !== 'undefined') {
                // Save visibility of the layer
                oChecked = map.hasLayer(overlayList[oName]);
                controlLayerSwitch.removeLayer(overlayList[oName]);
                overlayList[oName].remove();
            }
            overlayList[oName] = staticLayer;
            controlLayerSwitch.addOverlay(staticLayer, oName);
            // Keep visibility of the layer after a refresh
            if (oChecked) {
                staticLayer.addTo(map);
            }
        }
    });
}

$(document).ready(function () {
    initMap();
    loadLastPositions();
    loadStaticLayers();
    initSocket();
});
