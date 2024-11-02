import config from 'config';
import { promises as fs } from 'node:fs';
import { request } from 'node:http';
import { extname, basename } from 'node:path';
import { stringify } from 'node:querystring';
import { Parser } from 'xml2js';
import Logger from '../utils/logger.js';

const logger = Logger(import.meta.url);

export default class GpxPlayer {
    constructor(destPath, cbPoint) {
        this.destPath = destPath;
        if (typeof cbPoint === 'function') {
            this.cbPoint = cbPoint;
        } else {
            this.cbPoint = this.postMessage;
        }
        this.clear();
    }

    clear() {
        this.dirName = '';
        this.fileList = [];
        this.tracks = [];
    }

    // Create a list of all gpx files in the given directory
    async createFileList(dirName) {
        let allFiles;
        try {
            allFiles = await fs.readdir(dirName);
        } catch (err) {
            this.clear();
            logger.error('Unable to locate GPX files.', err.message);
            return [];
        }
        this.dirName = dirName;
        this.fileList = [];
        allFiles.forEach((file) => {
            if (extname(file) === '.gpx') {
                this.fileList.push(basename(file, '.gpx'));
            }
        });
        return this.fileList;
    }

    // Create new tracks from gpx files based on the given device list
    // Do not create if a track already exists
    addTracksByDevice(deviceList) {
        for (let device of deviceList) {
            const trackName = `${device.api_key}_${device.identifier}`;
            const track = this.getTrackByName(trackName);
            if (!track && this.fileList.indexOf(trackName) >= 0) {
                this.tracks.push(
                    new Track(
                        this.dirName,
                        trackName,
                        this.destPath,
                        this.cbPoint,
                    ),
                );
            }
        }
    }

    // Create new tracks from gpx files based on the given API key
    // Do not create if a track already exists
    addTracksByApiKey(apiKey) {
        for (let trackName of this.fileList) {
            if (trackName.split('_')[0] === apiKey) {
                const track = this.getTrackByName(trackName);
                if (!track && this.fileList.indexOf(trackName) >= 0) {
                    this.tracks.push(
                        new Track(
                            this.dirName,
                            trackName,
                            this.destPath,
                            this.cbPoint,
                        ),
                    );
                }
            }
        }
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
        const gpxQuerystring = stringify({
            device_id: data.device_id,
            gps_latitude: data.gps_latitude,
            gps_longitude: data.gps_longitude,
            gps_time: data.gps_time,
        });

        const options = {
            host: 'localhost',
            port: config.get('server.port'),
            path: this.destPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(gpxQuerystring),
            },
        };

        const req = request(options, (res) => {
            if (res.statusCode >= 300) {
                logger.error(
                    `GPX player failed HTTP POST with status code: ${res.statusCode}`,
                );
            }
        });

        req.on('error', (err) => {
            let errMessages = '';
            err.errors?.forEach((el) => (errMessages += ` ${el.message}.`));
            logger.error(`GPX player failed HTTP POST.${errMessages}`);
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
        this.points = [];
        this.pointsIndex = 0;
        this.isRunning = true;
        this.init();
    }

    async init() {
        try {
            this.points = await this.loadGpxFile();
            this.sendGpxPoint();
        } catch (err) {
            logger.error('Unable to load GPX file.', err.message);
        }
    }

    async loadGpxFile() {
        const fileName = this.dirName + this.name + '.gpx';
        const fileData = await fs.readFile(fileName);
        const xmlParser = new Parser();
        const parsedXml = await xmlParser.parseStringPromise(fileData);
        let points = parsedXml.gpx?.trk?.[0]?.trkseg?.[0]?.trkpt;
        if (!points) {
            points = [];
        }
        return points;
    }

    sendGpxPoint() {
        let curPoint = this._getPoint();
        this.pointsIndex += 1;
        let nextPoint = this._getPoint();
        if (curPoint && nextPoint) {
            let diffTime = this._getDiffTime(
                curPoint.gps_time,
                nextPoint.gps_time,
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
        if (this.pointsIndex >= this.points.length) {
            return null;
        } else {
            return {
                device_id: this.name,
                gps_latitude: this.points[this.pointsIndex].$.lat,
                gps_longitude: this.points[this.pointsIndex].$.lon,
                gps_time: this.points[this.pointsIndex].time[0],
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
