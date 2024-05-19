import { expect } from 'chai';
import config from 'config';
import { createServer } from 'http';
import GpxPlayer from '../services/gpxplayer.js';

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
const trackTest7p1s = {
    dirName: './tracks/test/',
    name: 'testkey_7p1s',
    destPath: '/location/gpx/test',
    points: [],
    pointsIndex: 0,
    isRunning: true,
};

function getTrackname(testDevice) {
    return `${testDevice.api_key}_${testDevice.identifier}`;
}

// Create a server that receives the requests from the gpx player
function startHttpServer(port) {
    server = createServer(function (req, res) {
        if (req.method === 'POST') {
            req.on('error', function (err) {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.write('An error occurred');
                    res.end();
                }
            });
            let body = '';
            req.on('data', function (chunk) {
                body += chunk.toString();
            });
            req.on('end', function () {
                let point = Object.fromEntries(new URLSearchParams(body));
                storePoint(point);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end();
            });
        } else {
            // Ignore all other requests except POST
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end();
        }
    }).listen(port);
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
        (points) => points.device_id === device_id,
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
    return new Promise(function (resolve) {
        setTimeout(resolve, delay);
    });
}

describe('GPX player', function () {
    describe('create gpx player', function () {
        it('should find all 6 gpx test files', async function () {
            startHttpServer(config.get('server.port'));
            gpxPlayer = new GpxPlayer('./tracks/test/', '/location/gpx/test');
            const fileList = await gpxPlayer.loadFileList(gpxPlayer.dirName);
            expect(fileList.length).to.equal(6);
        });
    });

    describe('play tracks from file and validate results', function () {
        it('should load and play the gpx test files of 5 devices', function () {
            gpxPlayer.addTracksByDevice([
                test7p1s,
                test4p2s,
                test3p3s,
                test2p6s,
                test_delay_too_short,
            ]);
            expect(gpxPlayer.tracks.length).to.equal(5);
            const aTrack = gpxPlayer.getTrackByName(getTrackname(test7p1s));
            expect(aTrack).to.deep.include(trackTest7p1s);
            expect(aTrack).to.have.property('cbPoint');
            expect(aTrack.cbPoint).to.be.a('function');
            const noTrack = gpxPlayer.getTrackByName('non-existing-track');
            expect(noTrack).to.be.null;
        });
        // !!! this.timeout() doesn't work with arrow functions. Use function() syntax. !!!
        it('should wait for playing of 5 devices to finish', async function () {
            this.timeout(8000);
            await waitForTimeout(7000);
            let totalRunning = 0;
            gpxPlayer.tracks.forEach(function (track) {
                if (track.isRunning) {
                    totalRunning = totalRunning + 1;
                }
            });
            expect(totalRunning).to.equal(0);
            stopHttpServer();
        });
        it('should report 7 points and 1 second delay (testkey_7p1s.gpx)', function () {
            const report = reportPoints(getTrackname(test7p1s));
            expect(report.totalPoints).to.equal(7);
            expect(report.minDelay).to.be.within(800, 1200);
            expect(report.maxDelay).to.be.within(800, 1200);
            expect(report.duration).to.be.within(5500, 6500);
        });
        it('should report 4 points and 2 seconds delay (testkey_4p2s.gpx)', function () {
            const report = reportPoints(getTrackname(test4p2s));
            expect(report.totalPoints).to.equal(4);
            expect(report.minDelay).to.be.within(1800, 2200);
            expect(report.maxDelay).to.be.within(1800, 2200);
            expect(report.duration).to.be.within(5500, 6500);
        });
        it('should report 3 points and 3 seconds delay (testkey_3p3s.gpx)', function () {
            const report = reportPoints(getTrackname(test3p3s));
            expect(report.totalPoints).to.equal(3);
            expect(report.minDelay).to.be.within(2800, 3200);
            expect(report.maxDelay).to.be.within(2800, 3200);
            expect(report.duration).to.be.within(5500, 6500);
        });
        it('should report 2 points and 6 seconds delay (testkey_2p6s.gpx)', function () {
            const report = reportPoints(getTrackname(test2p6s));
            expect(report.totalPoints).to.equal(2);
            expect(report.minDelay).to.be.within(5800, 6200);
            expect(report.maxDelay).to.be.within(5800, 6200);
            expect(report.duration).to.be.within(5500, 6500);
        });
        it('should report 7 points and 1 second delay (testkey_delay-too-short.gpx)', function () {
            const report = reportPoints(getTrackname(test_delay_too_short));
            expect(report.totalPoints).to.equal(7);
            expect(report.minDelay).to.be.within(800, 1200);
            expect(report.maxDelay).to.be.within(800, 1200);
            expect(report.duration).to.be.within(5500, 6500);
        });
        it('should cleanup all tracks', function () {
            gpxPlayer.cleanupTracks();
            expect(gpxPlayer.tracks.length).to.equal(0);
        });
    });
});
