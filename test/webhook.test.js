"use strict";
const chai = require('chai');
const chaihttp = require('chai-http');
const express = require('express');
const db = require('../src/db.js');
const webhook = require('../src/webhook.js');

chai.use(chaihttp);

// Setup express web server
const app = express();

app.post('/location/gpx', (req, res) => {
    webhook.processLocation(req, res, 'gpx');
});

app.post('/location/locative', (req, res) => {
    webhook.processLocation(req, res, 'locative');
});

// Setup database
const testUser = {
    username: 'testuser_webhook',
    fullName: 'User Webhook',
    email: 'test@user1',
    role: 'user',
    api_key: 'testkey'
};

let testUser_Id = null;
let testDevice_Id = [];

describe('Setup test user for database', () => {
    describe('#insertUser', () => {
        it('should create 1 user', async () => {
            try {
                const queryRes = await db.queryDbAsync('insertUser', [testUser.username, testUser.fullName, testUser.email, testUser.role, testUser.api_key]);
                queryRes.rowCount.should.equal(1);
            } catch(err) {
                throw new Error(err.message);
            }
        });   
    });
});

describe('Webhook', () => {
    describe('/post gpx with valid location data in query string parameters', () => {
        it('should respond with HTTP status 200', (done) => {
            let testQueryString = 'device_id=testkey_testdevice1&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';
            chai.request(app)
            .post('/location/gpx?' + testQueryString)
            .send('')
            .end((err, res) => {
                res.should.have.status(200);
                done();
            });
        });
    });
    describe('/post gpx with valid location data in body', () => {
        it('should respond with HTTP status 200', (done) => {
            let testQueryString = 'device_id=testkey_testdevice2&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';
            chai.request(app)
            .post('/location/gpx')
            .send(testQueryString)
            .end((err, res) => {
                res.should.have.status(200);
                done();
            });
        });
    });
    describe('/post gpx without location data', () => {
        it('should respond with HTTP status 200', (done) => {
            chai.request(app)
            .post('/location/gpx')
            .send('')
            .end((err, res) => {
                res.should.have.status(200);
                done();
            });
        });
    });
    describe('/post locative with valid location data in query string parameters', () => {
        it('should respond with HTTP status 200', (done) => {
            let testQueryString = 'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=testkey&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';
            chai.request(app)
            .post('/location/locative?' + testQueryString)
            .send('')
            .end((err, res) => {
                res.should.have.status(200);
                done();
            });
        });
    });
    describe('/post locative with valid location data in body', () => {
        it('should respond with HTTP status 200', (done) => {
            let testQueryString = 'device=12345678-ABCD-1234-ABCD-123456789ABD&device_model=iPad5%2C4&device_type=iOS&id=testkey&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';
            chai.request(app)
            .post('/location/locative')
            .send(testQueryString)
            .end((err, res) => {
                res.should.have.status(200);
                done();
            });
        });
    });
});

describe('Remove test user from database', () => {
    describe('#getUserByUsername', () => {
        it('should return 1 user', async () => {
            try {
                const queryRes = await db.queryDbAsync('getUserByUsername', [testUser.username]);
                if (queryRes.rowCount > 0) {
                    testUser_Id = queryRes.rows[0].user_id;
                } else {
                    testUser_Id = null;
                }
                queryRes.rowCount.should.equal(1);
            } catch(err) {
                throw new Error(err.message);
            }
        });   
    });

    describe('#getDevicesByUserId', () => {
        it('should return 4 devices', async () => {
            try {
                const queryRes = await db.queryDbAsync('getDevicesByUserId', [testUser_Id]);
                if (queryRes.rowCount > 0) {
                    queryRes.rows.forEach((element) => {
                        testDevice_Id.push(element.device_id);
                    });
                } else {
                    testDevice_Id = [];
                }
                queryRes.rowCount.should.equal(4);
            } catch(err) {
                throw new Error(err.message);
            }
        });   
    });

    describe('#deleteDevices', () => {
        it('should delete 4 devices', async () => {
            try {
                const queryRes = await db.queryDbAsync('deleteDevices', [testDevice_Id]);
                queryRes.rowCount.should.equal(4);
            } catch(err) {
                throw new Error(err.message);
            }
        });  
    });

    describe('#deleteUser', () => {
        it('should delete 1 user', async () => {
            try {
                const queryRes = await db.queryDbAsync('deleteUser', [testUser_Id]);
                queryRes.rowCount.should.equal(1);
            } catch(err) {
                throw new Error(err.message);
            }
        });   
    });
});
