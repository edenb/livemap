var config = require('config');
var http = require('http');
var url = require('url');
var qs = require('querystring');
var fs = require('fs');
var gpxParse = require("gpx-parse");

var port = config.get('server.port');
var gpxTracks = [];

function postMessage(destinationUrl, data) {
    var options = {
        host: url.parse(destinationUrl).hostname,
        port: url.parse(destinationUrl).port,
        path: url.parse(destinationUrl).pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    var req = http.request(options, function (res) {
        res.setEncoding('utf8');
        // Response is 'OK' if POST request is successful, '404 not found' if request not accepted
        res.on('data', function (chunk) {
        });
    });

    // Ignore errors if POST request fails, e.g. no response
    req.on('error', function (e) {
    });

    req.write(data);
    req.end();
}

function gpxPlayer(device_id, fileName, postUrl) {
    this.device_id = device_id;
    this.fileName = fileName;
    this.index = 0;
    this.isRunning = false;
    this.gpxPlayerData = {};
    this.postUrl = postUrl;
}

gpxPlayer.prototype.sendGpxPoint = function sendGpxPoint() {
    var diffTime;
    var gpxQuerystring = qs.stringify({
        device_id: this.device_id,
        gps_latitude: this.gpxPlayerData.tracks[0].segments[0][this.index].lat,
        gps_longitude: this.gpxPlayerData.tracks[0].segments[0][this.index].lon,
        gps_time: this.gpxPlayerData.tracks[0].segments[0][this.index].time.toISOString()
    });

    postMessage(this.postUrl, gpxQuerystring);
    this.index += 1;
    if (this.index < this.gpxPlayerData.tracks[0].segments[0].length) {
        diffTime = this.gpxPlayerData.tracks[0].segments[0][this.index].time.getTime() - this.gpxPlayerData.tracks[0].segments[0][this.index - 1].time.getTime();
        // Prevent very short or very long interval (1 sec < diffTime < 15 min). Also prevents negative intervals.
        if (diffTime < 1000) {
            diffTime = 1000;
        }
        if (diffTime > 900000) {
            diffTime = 900000;
        }
        setTimeout(this.sendGpxPoint.bind(this), diffTime);
    } else {
        this.isRunning = false;
    }
};

gpxPlayer.prototype.start = function start() {
    // Save the scope for later use.
    var self = this;

    if (this.isRunning === false) {
        // Read and parse GPX file 
        fs.readFile(this.fileName, function (fileError, fileData) {
            if (fileError === null) {
                gpxParse.parseGpx(fileData, function (error, data) {
                    if (error === null) {
                        // Because the scope of 'this' has changed use the one that was saved.
                        self.isRunning = true;
                        self.gpxPlayerData = data;
                        self.index = 0;
                        setTimeout(self.sendGpxPoint.bind(self), 0);
                    } else {
                        console.error('Wrong format of GPX file.', error);
                    }
                });
            } else {
                console.error('Unable to open GPX file.', fileError);
            }
        });
    }
};

function startAll() {
    var allFiles, gpxFiles = {}, fileSplit, i, fileExt, fileName, key;

    fs.readdir('./tracks/', function (err, allFiles) {
        if (err === null) {
            for (i in allFiles) {
                fileExt = '';
                fileName = '';
                fileSplit = allFiles[i].split('.');
                if (fileSplit.length > 1) {
                    fileExt = fileSplit[fileSplit.length - 1];
                }
                // Only allow file names with format: name.ext (only one dot)
                if (fileSplit.length === 2) {
                    fileName = fileSplit[0];
                }
                // If a valid file found
                if (fileName !== '' && fileExt === 'gpx') {
                    gpxFiles[fileName] = fileName;
                }
            }

            // Check for added track files
            for (key in gpxFiles) {
                if (gpxFiles.hasOwnProperty(key)) {
                    if (typeof gpxTracks[key] === 'undefined') {
                        gpxTracks[key] = new gpxPlayer(gpxFiles[key], './tracks/' +  gpxFiles[key] + '.gpx', 'http://localhost:' + port + '/location/gpx');
                        console.log('Added track: ' + gpxTracks[key].fileName);
                    }
                }
            }

            // Check for removed track files and start all players (if not already started)
            for (key in gpxTracks) {
                if (gpxTracks.hasOwnProperty(key)) {
                    if (typeof gpxFiles[key] === 'undefined') {
                        console.log('Removed track: ' + gpxTracks[key].fileName);
                        delete gpxTracks[key];
                    } else {
                        gpxTracks[key].start();
                    }
                }
            }
        } else {
            console.error('Missing tracks directory.', err);
        }
    });
}

module.exports.startAll = startAll;
