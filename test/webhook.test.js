"use strict";
const chai = require('chai');
const chaihttp = require('chai-http');
const express = require('express');
const webhook = require('../src/webhook.js');

chai.use(chaihttp);

var app = express();

app.post('/location/gpx', (req, res) => {
    webhook.processLocation(req, res, 'gpx');
});

app.post('/location/geofancy', (req, res) => {
    webhook.processLocation(req, res, 'geofancy');
});

describe('Webhook', () => {
    describe('/post gpx', () => {
        it('should respond with HTTP status 200', (done) => {
            let testQueryString = 'device_id=testkey1_testdevice1&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';
            chai.request(app)
            .post('/location/gpx?' + testQueryString)
            .send('')
            .end((err, res) => {
                res.should.have.status(200);
            });
            done();
        });
    });
});
