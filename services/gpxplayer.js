'use strict';
const config = require('config');
var http = require('http');
var qs = require('querystring');
const fs = require('fs');
const path = require('path');
const gpxParse = require('gpx-parse');
const logger = require('../utils/logger');

class GpxPlayer {
    constructor(dirName, destPath, cbPoint) {
        this.dirName = dirName;
        this.destPath = destPath;
        if (typeof cbPoint === 'function') {
            this.cbPoint = cbPoint;
        } else {
            this.cbPoint = this.postMessage;
        }
        this.tracks = [];
        this.fileTrackNames = [];
        // Get the list of GPX files from disk
        this.updateFileTrackNames(dirName);
    }

    // Create new tracks from gpx files based on the given device list
    // Do not create if a track already exists
    addTracks(deviceList) {
        for (let device of deviceList) {
            let trackName = `${device.api_key}_${device.identifier}`;
            let track = this.getTrackByName(trackName);
            if (!track && this.fileTrackNames.indexOf(trackName) >= 0) {
                this.tracks.push(
                    new Track(
                        this.dirName,
                        trackName,
                        this.destPath,
                        this.cbPoint
                    )
                );
            }
        }
    }

    // Create a list of all gpx files in the given directory
    updateFileTrackNames(dirName) {
        fs.readdir(dirName, (err, allFiles) => {
            if (err) {
                this.fileTrackNames = [];
            } else {
                let fileTrackNames = [];
                allFiles.forEach((file) => {
                    if (path.extname(file) === '.gpx') {
                        fileTrackNames.push(path.basename(file, '.gpx'));
                    }
                });
                this.fileTrackNames = fileTrackNames;
            }
        });
    }

    // Get the track with the given name
    getTrackByName(name) {
        for (let track of this.tracks) {
            if (track.name === name) {
                return track;
            }
        }
        return null;
    }

    // Remove all stopped tracks
    cleanupTracks() {
        let index = 0;
        while (index < this.tracks.length) {
            if (!this.tracks[index].isRunning) {
                this.tracks.splice(index, 1);
            } else {
                index++;
            }
        }
    }

    // Send HTTP POST request
    postMessage(data) {
        const gpxQuerystring = qs.stringify({
            device_id: data.device_id,
            gps_latitude: data.gps_latitude,
            gps_longitude: data.gps_longitude,
            gps_time: data.gps_time,
        });

        const options = {
            host: 'localhost',
            port: config.get('server.port'),
            path: this.destPath + '?' + gpxQuerystring,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': Buffer.byteLength(gpxQuerystring),
            },
        };

        const req = http.request(options, (res) => {
            if (res.statusCode >= 300) {
                logger.error(
                    `GPX player failed HTTP POST with status code: ${res.statusCode}`
                );
            }
        });

        req.on('error', (err) => {
            logger.error('GPX player failed HTTP POST.', err);
        });

        req.write(gpxQuerystring);
        req.end();
    }
}

class Track {
    constructor(dirName, name, destPath, cbPoint) {
        this.dirName = dirName;
        this.name = name;
        this.destPath = destPath;
        this.cbPoint = cbPoint;
        this.gpxData = {};
        this.gpxIndex = 0;
        this.isRunning = false;
        this.init();
    }

    async init() {
        try {
            this.gpxData = await this.loadGpxFile();
            this.sendGpxPoint();
        } catch (err) {
            logger.error('Unable to open GPX file.', err);
        }
    }

    loadGpxFile() {
        return new Promise((resolve, reject) => {
            let fileName = this.dirName + this.name + '.gpx';
            fs.readFile(fileName, (err, fileData) => {
                if (err) {
                    reject(err);
                } else {
                    gpxParse.parseGpx(fileData, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                }
            });
        });
    }

    sendGpxPoint() {
        let curPoint = this._getPoint();
        this.gpxIndex += 1;
        let nextPoint = this._getPoint();
        if (curPoint && nextPoint) {
            let diffTime = this._getDiffTime(
                curPoint.gps_time,
                nextPoint.gps_time
            );
            setTimeout(this.sendGpxPoint.bind(this), diffTime);
            this.isRunning = true;
        } else {
            this.isRunning = false;
        }
        if (curPoint) {
            this.cbPoint(curPoint);
        }
    }

    _getPoint() {
        if (this.gpxIndex >= this.gpxData.tracks[0].segments[0].length) {
            return null;
        } else {
            return {
                device_id: this.name,
                gps_latitude: this.gpxData.tracks[0].segments[0][this.gpxIndex]
                    .lat,
                gps_longitude: this.gpxData.tracks[0].segments[0][this.gpxIndex]
                    .lon,
                gps_time: this.gpxData.tracks[0].segments[0][
                    this.gpxIndex
                ].time.toISOString(),
            };
        }
    }

    _getDiffTime(curPointTime, nextPointTime) {
        let diffTime = Date.parse(nextPointTime) - Date.parse(curPointTime);
        // Prevent very short or very long interval (1 sec < diffTime < 15 min). Also prevents negative intervals.
        if (diffTime < 1000) {
            diffTime = 1000;
        }
        if (diffTime > 900000) {
            diffTime = 900000;
        }
        return diffTime;
    }
}

module.exports.GpxPlayer = GpxPlayer;
