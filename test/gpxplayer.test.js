'use strict';
const chai = require('chai');
const gp = require('../services/gpxplayer');

const should = chai.should();

let gpxPlayer = {};
let points = [];
const testDevice = { api_key: 'testkey', identifier: 'test' };
const trackName = `${testDevice.api_key}_${testDevice.identifier}`;

function storeResult(data) {
    points.push(data);
}

describe('GPX player', () => {
    describe('create gpx player', () => {
        it('should find all gpx files', async () => {
            try {
                gpxPlayer = new gp.GpxPlayer('./tracks/test/', '', storeResult);
                const fileList = await gpxPlayer.loadFileList(
                    gpxPlayer.dirName
                );
                fileList.length.should.equal(1);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
    describe('load track from file and play track', () => {
        it('should find the GPX test file', async () => {
            try {
                gpxPlayer.addTracks([testDevice]);
                const track = gpxPlayer.getTrackByName(trackName);
                should.exist(track);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
});
