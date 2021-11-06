'use strict';
const config = require('config');
const http = require('http');
const chai = require('chai');
const gp = require('../services/gpxplayer');

const should = chai.should();

let server;
let gpxPlayer = {};
let points = [];
const test7p1s = { api_key: 'testkey', identifier: '7p1s' };
const test4p2s = { api_key: 'testkey', identifier: '4p2s' };
const test3p3s = { api_key: 'testkey', identifier: '3p3s' };
const test2p6s = { api_key: 'testkey', identifier: '2p6s' };
const test_delay_too_short = {
    api_key: 'testkey',
    identifier: 'delay-too-short',
};

function getTrackname(testDevice) {
    return `${testDevice.api_key}_${testDevice.identifier}`;
}

// Create a server that receives the requests from the gpx player
function startHttpServer(port) {
    server = http
        .createServer((req, res) => {
            if (req.method === 'POST') {
                req.on('error', (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'text/html' });
                        res.write('An error occurred');
                        res.end();
                    }
                });
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    let point = Object.fromEntries(new URLSearchParams(body));
                    storePoint(point);
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end();
                });
            }
        })
        .listen(port);
}

function stopHttpServer() {
    server.close();
}

// Logger for points. Can be used as callback for GpxPlayer
// Point: {
//    device_id: 'testkey_test',
//    gps_latitude: 0.2,
//    gps_longitude: -0.2,
//    gps_time: '2000-01-01T00:00:01.000Z'
//  }
function storePoint(point) {
    const now = new Date().toISOString();
    points.push({ ts: now, ...point });
}

function reportPoints(device_id) {
    const filteredPoints = points.filter(
        (points) => points.device_id === device_id
    );
    let minDelay = null;
    let maxDelay = null;
    let prevTime = null;
    for (let point of filteredPoints) {
        if (prevTime) {
            let delay = Date.parse(point.ts) - Date.parse(prevTime);
            if (minDelay) {
                if (delay < minDelay) {
                    minDelay = delay;
                }
            } else {
                minDelay = delay;
            }
            if (maxDelay) {
                if (delay > maxDelay) {
                    maxDelay = delay;
                }
            } else {
                maxDelay = delay;
            }
        }
        prevTime = point.ts;
    }
    const duration =
        Date.parse(filteredPoints[filteredPoints.length - 1].ts) -
        Date.parse(filteredPoints[0].ts);
    const totalPoints = filteredPoints.length;
    return {
        minDelay: minDelay,
        maxDelay: maxDelay,
        totalPoints: totalPoints,
        duration: duration,
    };
}

// Delay in msec
function waitForTimeout(delay) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}

describe('GPX player', () => {
    describe('create gpx player', () => {
        it('should find all 6 gpx test files', async () => {
            try {
                startHttpServer(config.get('server.port'));
                //gpxPlayer = new gp.GpxPlayer('./tracks/test/', '', storePoint);
                gpxPlayer = new gp.GpxPlayer(
                    './tracks/test/',
                    '/location/gpx/test'
                );
                const fileList = await gpxPlayer.loadFileList(
                    gpxPlayer.dirName
                );
                fileList.length.should.equal(6);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
    describe('play tracks from file and validate results', () => {
        it('should load and play the gpx test files of 5 devices', () => {
            try {
                gpxPlayer.addTracksByDevice([
                    test7p1s,
                    test4p2s,
                    test3p3s,
                    test2p6s,
                    test_delay_too_short,
                ]);
                gpxPlayer.tracks.length.should.equal(5);
                should.exist(gpxPlayer.getTrackByName(getTrackname(test7p1s)));
                should.not.exist(
                    gpxPlayer.getTrackByName('non-existing-track-name')
                );
            } catch (err) {
                throw new Error(err.message);
            }
        });
        // !!! this.timeout() doesn't work with arrow functions. Use function() syntax. !!!
        it('should wait for playing of 5 devices to finish', async function () {
            try {
                this.timeout(8000);
                await waitForTimeout(7000);
                let totalRunning = 0;
                gpxPlayer.tracks.forEach((track) => {
                    if (track.isRunning) {
                        totalRunning = totalRunning + 1;
                    }
                });
                totalRunning.should.equal(0);
                stopHttpServer();
            } catch (err) {
                throw new Error(err.message);
            }
        });
        it('should report 7 points and 1 second delay (testkey_7p1s.gpx)', () => {
            try {
                const report = reportPoints(getTrackname(test7p1s));
                report.totalPoints.should.equal(7);
                report.minDelay.should.be.within(800, 1200);
                report.maxDelay.should.be.within(800, 1200);
                report.duration.should.be.within(5500, 6500);
            } catch (err) {
                throw new Error(err.message);
            }
        });
        it('should report 4 points and 2 seconds delay (testkey_4p2s.gpx)', () => {
            try {
                const report = reportPoints(getTrackname(test4p2s));
                report.totalPoints.should.equal(4);
                report.minDelay.should.be.within(1800, 2200);
                report.maxDelay.should.be.within(1800, 2200);
                report.duration.should.be.within(5500, 6500);
            } catch (err) {
                throw new Error(err.message);
            }
        });
        it('should report 3 points and 3 seconds delay (testkey_3p3s.gpx)', () => {
            try {
                const report = reportPoints(getTrackname(test3p3s));
                report.totalPoints.should.equal(3);
                report.minDelay.should.be.within(2800, 3200);
                report.maxDelay.should.be.within(2800, 3200);
                report.duration.should.be.within(5500, 6500);
            } catch (err) {
                throw new Error(err.message);
            }
        });
        it('should report 2 points and 6 seconds delay (testkey_2p6s.gpx)', () => {
            try {
                const report = reportPoints(getTrackname(test2p6s));
                report.totalPoints.should.equal(2);
                report.minDelay.should.be.within(5800, 6200);
                report.maxDelay.should.be.within(5800, 6200);
                report.duration.should.be.within(5500, 6500);
            } catch (err) {
                throw new Error(err.message);
            }
        });
        it('should report 7 points and 1 second delay (testkey_delay-too-short.gpx)', () => {
            try {
                const report = reportPoints(getTrackname(test_delay_too_short));
                report.totalPoints.should.equal(7);
                report.minDelay.should.be.within(800, 1200);
                report.maxDelay.should.be.within(800, 1200);
                report.duration.should.be.within(5500, 6500);
            } catch (err) {
                throw new Error(err.message);
            }
        });
        it('should cleanup all tracks', () => {
            try {
                gpxPlayer.cleanupTracks();
                gpxPlayer.tracks.length.should.equal(0);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
});
