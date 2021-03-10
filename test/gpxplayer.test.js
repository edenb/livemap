'use strict';
const gp = require('../services/gpxplayer');

let gpxPlayer = {};
let points = [];
const test7p1s = { api_key: 'testkey', identifier: '7p1s' };
const test4p2s = { api_key: 'testkey', identifier: '4p2s' };
const test3p3s = { api_key: 'testkey', identifier: '3p3s' };
const test2p6s = { api_key: 'testkey', identifier: '2p6s' };

function getTrackname(testDevice) {
    return `${testDevice.api_key}_${testDevice.identifier}`;
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
        it('should find all 5 gpx test files', async () => {
            try {
                gpxPlayer = new gp.GpxPlayer('./tracks/test/', '', storePoint);
                const fileList = await gpxPlayer.loadFileList(
                    gpxPlayer.dirName
                );
                fileList.length.should.equal(5);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
    describe('play tracks from file and validate results', () => {
        it('should load and play the gpx test files of 4 devices', () => {
            try {
                gpxPlayer.addTracks([test7p1s, test4p2s, test3p3s, test2p6s]);
                gpxPlayer.tracks.length.should.equal(4);
            } catch (err) {
                throw new Error(err.message);
            }
        });
        // !!! this.timeout() doesn't work with arrow functions. Use function() syntax. !!!
        it('should wait for playing of 4 devices to finish', async function () {
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
    });
});
