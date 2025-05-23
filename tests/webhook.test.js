import { expect } from 'chai';
import { parse } from 'node:querystring';
import { spy } from 'sinon';
import { request } from './helpers/chai.js';
import {
    addRoutes,
    createWebServer,
    destroyWebServer,
} from './helpers/webserver.js';
import App from '../src/app.js';
import routesWebhook from '../src/routes/webhook.js';

// Setup HTTP querystrings
const gpx1 =
    'device_id=testerkey_testdevice1&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';
const gpx2 =
    'device_id=testerkey_testdevice2&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';
const gpx3 = '&&';
const loc_dev1 =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=testerkey&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';
const loc_dev2 =
    'device=12345678-ABCD-1234-ABCD-123456789ABD&device_model=iPad5%2C4&device_type=iOS&id=testerkey&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';
const loc_tag1_enter =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=testerkey:tag1&latitude=0&longitude=0&timestamp=1571508472.691251&trigger=enter';
const loc_tag1_exit =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=testerkey:tag1&latitude=0&longitude=0&timestamp=1571508472.691251&trigger=exit';

describe('Webhooks', function () {
    const app = App();
    const callbackSpy = spy();
    const testBasePath = '/test/location';
    let webServer;

    before(async function () {
        // Start a webserver
        webServer = await createWebServer(app, 3001);
        addRoutes(app, `${testBasePath}`, routesWebhook(callbackSpy));
    });

    after(async function () {
        // Destroy the webserver
        await destroyWebServer(webServer);
    });

    afterEach(function () {
        callbackSpy.resetHistory();
    });

    describe('/post gpx with valid location data in query string parameters', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/gpx`)
                .query(gpx1)
                .send('');
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('gpx');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(gpx1));
        });
    });

    describe('/post gpx with valid location data in body', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/gpx`)
                .send(gpx2);
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('gpx');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(gpx2));
        });
    });

    describe('/post gpx with invalid location data in query string parameters', function () {
        it('should respond with HTTP status 422', async function () {
            const res = await request(app)
                .post(`${testBasePath}/gpx`)
                .query(gpx3)
                .send('');
            expect(res).to.have.status(422);
        });
    });

    describe('/post gpx without location data', function () {
        it('should respond with HTTP status 422', async function () {
            const res = await request(app).post(`${testBasePath}/gpx`).send('');
            expect(res).to.have.status(422);
        });
    });

    describe('/post locative with valid location data in query string parameters', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/locative`)
                .query(loc_dev1)
                .send('');
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('locative');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(loc_dev1));
        });
    });

    describe('/post locative with valid location data in body', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/locative`)
                .send(loc_dev2);
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('locative');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(loc_dev2));
        });
    });

    describe('/post locative with entering tag data in query string parameters', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/locative`)
                .query(loc_tag1_enter)
                .send('');
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('locative');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(loc_tag1_enter));
        });
    });

    describe('/post locative with entering tag data in body', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/locative`)
                .send(loc_tag1_enter);
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('locative');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(loc_tag1_enter));
        });
    });

    describe('/post locative with exiting tag data in query string parameters', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/locative`)
                .query(loc_tag1_exit)
                .send('');
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('locative');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(loc_tag1_exit));
        });
    });

    describe('/post locative with exiting tag data in body', function () {
        it('should respond with HTTP status 200', async function () {
            const res = await request(app)
                .post(`${testBasePath}/locative`)
                .send(loc_tag1_exit);
            expect(res).to.have.status(200);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('locative');
            expect(callbackSpy.args[0][2]).to.deep.equal(parse(loc_tag1_exit));
        });
    });

    describe('/post locative without location data', function () {
        it('should respond with HTTP status 422', async function () {
            const res = await request(app)
                .post(`${testBasePath}/locative`)
                .send('');
            expect(res).to.have.status(422);
        });
    });

    describe('/post gpx on non-existing path', function () {
        it('should respond with HTTP status 404', async function () {
            const res = await request(app)
                .post(`${testBasePath}/nonexisting`)
                .query(gpx1)
                .send('');
            expect(res).to.have.status(404);
        });
    });
});
