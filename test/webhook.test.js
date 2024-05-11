import * as chai from 'chai';
import chaiHttp from 'chai-http';
import express from 'express';
import * as usr from '../models/user.js';
import * as dev from '../models/device.js';
import routesWebhook from '../routes/webhook.js';

chai.should();
// Below is a temporary workaround because latest versions of chai do not support plugins like chai-http
// When fixed should be replaced by: chai.use(chaiHttp);
const { request } = chai.use(chaiHttp);

// Setup test user
let testUser = {
    username: 'testuser_webhook',
    fullname: 'User Webhook',
    email: 'test@user1',
    role: 'user',
    api_key: 'testkey',
    password: 'testuser_webhook',
};

// Setup HTTP querystrings
const gpx1 =
    'device_id=testkey_testdevice1&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';
const gpx2 =
    'device_id=testkey_testdevice2&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';
const gpx3 = 'this_is_an_invalid_gpx_string';
const loc_dev1 =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=testkey&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';
const loc_dev2 =
    'device=12345678-ABCD-1234-ABCD-123456789ABD&device_model=iPad5%2C4&device_type=iOS&id=testkey&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';
const loc_tag1_enter =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=testkey:tag1&latitude=0&longitude=0&timestamp=1571508472.691251&trigger=enter';
const loc_tag1_exit =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=testkey:tag1&latitude=0&longitude=0&timestamp=1571508472.691251&trigger=exit';

// Setup express web server
const app = express();
app.use('/location', routesWebhook());

describe('Setup test user', () => {
    describe('#changeDetails', () => {
        it('should create 1 user', async () => {
            try {
                const queryRes = await usr.addUser(0, testUser);
                queryRes.rowCount.should.equal(1);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
});

describe('Webhook', () => {
    describe('/post gpx with valid location data in query string parameters', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/gpx?' + gpx1)
                .send('')
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
    describe('/post gpx with valid location data in body', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/gpx')
                .send(gpx2)
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
    describe('/post gpx with invalid location data in query string parameters', () => {
        it('should respond with HTTP status 422', (done) => {
            request(app)
                .post('/location/gpx?' + gpx3)
                .send('')
                .end((err, res) => {
                    res.should.have.status(422);
                    done();
                });
        });
    });
    describe('/post gpx without location data', () => {
        it('should respond with HTTP status 422', (done) => {
            request(app)
                .post('/location/gpx')
                .send('')
                .end((err, res) => {
                    res.should.have.status(422);
                    done();
                });
        });
    });
    describe('/post locative with valid location data in query string parameters', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/locative?' + loc_dev1)
                .send('')
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
    describe('/post locative with valid location data in body', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/locative')
                .send(loc_dev2)
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
    describe('/post locative with entering tag data in query string parameters', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/locative?' + loc_tag1_enter)
                .send('')
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
    describe('/post locative with entering tag data in body', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/locative')
                .send(loc_tag1_enter)
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
    describe('/post locative with exiting tag data in query string parameters', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/locative?' + loc_tag1_exit)
                .send('')
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
    describe('/post locative with exiting tag data in body', () => {
        it('should respond with HTTP status 200', (done) => {
            request(app)
                .post('/location/locative')
                .send(loc_tag1_exit)
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });
});

describe('Remove test user including owned devices', () => {
    let testDevices = [];
    describe('#getUserByField', () => {
        it('should return 1 user', async () => {
            try {
                const queryRes = await usr.getUserByField(
                    'username',
                    testUser.username,
                );
                if (queryRes.rowCount > 0) {
                    testUser = queryRes.rows[0];
                }
                queryRes.rowCount.should.equal(1);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
    describe('#getOwnedDevicesByField', () => {
        it('should return 5 devices', async () => {
            try {
                const queryRes = await dev.getOwnedDevicesByField(
                    'user_id',
                    testUser.user_id,
                );
                testDevices = queryRes.rows;
                queryRes.rowCount.should.equal(5);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
    describe('#deleteDevicesById', () => {
        it('should delete 5 devices', async () => {
            try {
                const ids = testDevices.map(({ device_id }) => device_id);
                const queryRes = await dev.deleteDevicesById(ids);
                queryRes.rowCount.should.equal(5);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
    describe('#deleteUser', () => {
        it('should delete 1 user', async () => {
            try {
                const queryRes = await usr.deleteUser(0, testUser);
                queryRes.rowCount.should.equal(1);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
});
