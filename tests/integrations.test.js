import { expect } from 'chai';
import express from 'express';
import { parse } from 'node:querystring';
import { spy } from 'sinon';
import request from './helpers/chai.js';
import { addUserAndDevices, removeUserAndDevices } from './helpers/database.js';
import {
    createMqttClient,
    createMqttServer,
    destroyMqttServer,
    publishMessage,
} from './helpers/mqtt.js';
import {
    addRouter,
    createWebServer,
    destroyWebServer,
} from './helpers/webserver.js';
import routesWebhook from '../src/routes/webhook.js';
import * as mqttService from '../src/services/mqtt.js';
import { processLocation } from '../src/utils/ingester.js';

const mqttMessage =
    '{"id":"test2", "apikey":"12345678", "timestamp":"2024-05-10T15:14:31.191Z", "lat":"32.123", "lon":"-110.123"}';

const mqttMessageProcessed = {
    api_key: '12345678',
    identifier: 'test2',
    device_id_tag: null,
    identifier_tag: null,
    api_key_tag: null,
    alias: 'test2',
    loc_timestamp: '2024-05-10T15:14:31.191Z',
    loc_lat: 32.123,
    loc_lon: -110.123,
    loc_type: null,
    loc_attr: undefined,
};

const gpxMessage =
    'device_id=12345678_testdevice1&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';

const gpxMessageProcessed = {
    api_key: '12345678',
    identifier: 'testdevice1',
    alias: 'Test device 1',
    device_id_tag: null,
    api_key_tag: null,
    identifier_tag: null,
    loc_timestamp: '2019-01-01T00:00:00.000Z',
    loc_lat: 40.7579747,
    loc_lon: -73.9855426,
    loc_type: 'rec',
    loc_attr: null,
};

const locDevMessage =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=12345678&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';

const locDevMessageProcessed = {
    api_key: '12345678',
    device_id_tag: null,
    alias: '12345678-ABCD-1234-ABCD-123456789ABC',
    loc_timestamp: '2019-08-22T15:11:00.187Z',
    loc_lat: 40.7579747,
    loc_lon: -73.9855426,
    loc_attr: null,
    loc_type: 'now',
};

const locTagMessage =
    'device=12345678-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=12345678:tag1&latitude=0&longitude=0&timestamp=1571508472.691251&trigger=enter';

const locTagMessageProcessed = {
    loc_timestamp: '2019-10-19T18:07:52.691Z',
    api_key: '12345678',
    alias: 'tag1',
    loc_lat: 0,
    loc_lon: 0,
    loc_attr: null,
    loc_type: 'now',
};

// Setup test user
const testUser = {
    username: 'testuser',
    fullname: 'Test User',
    email: 'test@testuser',
    role: 'viewer',
    api_key: '12345678',
    password: 'testuser',
};

const testDevice = {
    api_key: '12345678',
    identifier: 'testdevice1',
    alias: 'Test device 1',
};

describe('Integrations', function () {
    let mqttServer;
    let mqttServiceClient;
    let mqttTestClient;
    let webServer;
    const app = express();
    const processLocationSpy = spy(processLocation);

    before(async function () {
        // Create a test user and add test devices
        await addUserAndDevices(testUser, [testDevice]);
        // Create a local MQTT server
        mqttServer = await createMqttServer(mqttService.getBrokerUrl().port);
        // Start the MQTT client service
        mqttServiceClient = mqttService.start(processLocationSpy);
        // Start an MQTT test client
        mqttTestClient = createMqttClient();
        // Start a webserver
        webServer = await createWebServer(app, 3000);
        addRouter(app, '/location', routesWebhook(processLocationSpy));
    });

    after(async function () {
        // Remove the test user and its owned devices
        await removeUserAndDevices(testUser);
        // Remove the MQTT test client
        await mqttTestClient.endAsync();
        // Remove the MQTT client service
        await mqttServiceClient.endAsync();
        // Destroy the local MQTT server
        await destroyMqttServer(mqttServer);
        // Destroy the webserver
        await destroyWebServer(webServer);
    });

    afterEach(function () {
        processLocationSpy.resetHistory();
    });

    describe('Process an MQTT message', function () {
        it('should successfully process the received MQTT message', async function () {
            await publishMessage(
                mqttTestClient,
                mqttServiceClient,
                'livemap/test',
                mqttMessage,
            );
            expect(processLocationSpy.calledOnce).to.equal(true);
            expect(processLocationSpy.args[0][0]).to.equal('mqtt');
            expect(processLocationSpy.args[0][1].toString()).to.equal(
                mqttMessage,
            );
            const processed = await processLocationSpy.returnValues[0];
            expect(processed).to.include(mqttMessageProcessed);
        });
    });

    describe('Process GPX webhook data', function () {
        it('should successfully process the received GPX webhook message', async function () {
            const res = await request(app)
                .post('/location/gpx')
                .query(gpxMessage)
                .send('');
            expect(res).have.status(200);
            expect(processLocationSpy.calledOnce).to.equal(true);
            expect(processLocationSpy.args[0][0]).to.equal('gpx');
            expect(processLocationSpy.args[0][1]).to.deep.equal(
                parse(gpxMessage),
            );
            const processed = await processLocationSpy.returnValues[0];
            expect(processed).to.include(gpxMessageProcessed);
        });
    });

    describe('Process Locative device data', function () {
        it('should successfully process the received Locative device message', async function () {
            const res = await request(app)
                .post('/location/locative')
                .query(locDevMessage)
                .send('');
            expect(res).have.status(200);
            expect(processLocationSpy.calledOnce).to.equal(true);
            expect(processLocationSpy.args[0][0]).to.equal('locative');
            expect(processLocationSpy.args[0][1]).to.deep.equal(
                parse(locDevMessage),
            );
            const processed = await processLocationSpy.returnValues[0];
            expect(processed).to.include(locDevMessageProcessed);
        });
    });

    describe('Process Locative tag data', function () {
        it('should successfully process the received Locative tag message', async function () {
            const res = await request(app)
                .post('/location/locative')
                .query(locTagMessage)
                .send('');
            expect(res).have.status(200);
            expect(processLocationSpy.calledOnce).to.equal(true);
            expect(processLocationSpy.args[0][0]).to.equal('locative');
            expect(processLocationSpy.args[0][1]).to.deep.equal(
                parse(locTagMessage),
            );
            const processed = await processLocationSpy.returnValues[0];
            expect(processed).to.include(locTagMessageProcessed);
        });
    });
});
