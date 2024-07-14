import { expect } from 'chai';
import express from 'express';
import {
    addRouter,
    createWebServer,
    destroyWebServer,
} from './helpers/webserver.js';
import GpxPlayer from '../src/services/gpxplayer.js';

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

let points = [];

function getTrackname(testDevice) {
    return `${testDevice.api_key}_${testDevice.identifier}`;
}

function routerGpxPoint() {
    const router = express.Router();

    router.post(
        '/',
        express.urlencoded({ extended: false }),
        async function (req, res) {
            const now = new Date().toISOString();
            points.push({ ts: now, ...req.query });
            res.sendStatus(200);
        },
    );

    return router;
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
    let gpxPlayer;
    let webServer;
    const app = express();

    before(async function () {
        // Start a webserver
        webServer = await createWebServer(app, 3000);
        addRouter(app, '/location/gpx/test', routerGpxPoint());
    });

    after(async function () {
        // Destroy the webserver
        await destroyWebServer(webServer);
    });

    describe('create gpx player', function () {
        it('should find all 6 gpx test files', async function () {
            gpxPlayer = new GpxPlayer('/location/gpx/test');
            const fileList = await gpxPlayer.createFileList('./tracks/test/');
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

    describe('create gpx player on an invalid directory', function () {
        it('should find 0 gpx test files', async function () {
            gpxPlayer = new GpxPlayer('/location/gpx/test');
            const fileList = await gpxPlayer.createFileList('a-directory');
            expect(fileList.length).to.equal(0);
        });
    });

    describe('add tracks by api key', function () {
        it('should find all 6 gpx test files', async function () {
            gpxPlayer = new GpxPlayer('/location/gpx/test');
            await gpxPlayer.createFileList('./tracks/test/');
            gpxPlayer.addTracksByApiKey('testkey');
            expect(gpxPlayer.tracks.length).to.equal(6);
        });
    });
});
