import { expect } from 'chai';
import express from 'express';
import { parse } from 'node:querystring';
import { spy } from 'sinon';
import { request, subset } from './helpers/chai.js';
import {
    addUserAndDevices,
    getDevices,
    removeUserAndDevices,
} from './helpers/database.js';
import {
    gpxMessage,
    gpxMessageProcessed,
    locDevMessage,
    locDevMessageProcessed,
    locTagMessage,
    locTagMessageProcessed,
    mqttMessage,
    mqttMessageProcessed,
    vwr1Auth,
    vwr1,
} from './helpers/fixtures.js';
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

describe('Integrations', function () {
    let mqttServer;
    let mqttServiceClient;
    let mqttTestClient;
    let webServer;
    const app = express();
    const wrapper = { processLocation: processLocation };

    before(async function () {
        // Spy on function processLocation
        spy(wrapper, 'processLocation');
        // Create a local MQTT server
        mqttServer = await createMqttServer(mqttService.getBrokerUrl().port);
        // Start the MQTT client service
        mqttServiceClient = mqttService.start(wrapper.processLocation);
        // Start an MQTT test client
        mqttTestClient = createMqttClient();
        // Start a webserver
        webServer = await createWebServer(app, 3000);
        addRouter(app, '/location', routesWebhook(wrapper.processLocation));
    });

    after(async function () {
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
        wrapper.processLocation.resetHistory();
    });

    describe('Process an MQTT message', function () {
        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(vwr1);
        });
        it('should process a message from a new device', async function () {
            await publishMessage(
                mqttTestClient,
                mqttServiceClient,
                'livemap/test',
                mqttMessage,
            );
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('mqtt');
            expect(wrapper.processLocation.args[0][2].toString()).to.equal(
                mqttMessage,
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(mqttMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(1);
            expect(devices[0]).to.include({
                identifier: 'vwr1Dev1',
                alias: 'vwr1Dev1',
            });
        });
        it('should process a message from an already created device', async function () {
            await publishMessage(
                mqttTestClient,
                mqttServiceClient,
                'livemap/test',
                mqttMessage,
            );
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('mqtt');
            expect(wrapper.processLocation.args[0][2].toString()).to.equal(
                mqttMessage,
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(mqttMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(1);
        });
    });

    describe('Process GPX webhook data', function () {
        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(vwr1);
        });
        it('should process a message from a new device', async function () {
            const res = await request(app)
                .post('/location/gpx')
                .query(gpxMessage)
                .send('');
            expect(res).to.have.status(200);
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('gpx');
            expect(wrapper.processLocation.args[0][2]).to.deep.equal(
                parse(gpxMessage),
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(gpxMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(1);
            expect(devices[0]).to.include({
                identifier: 'vwr1Dev1',
                alias: 'vwr1Dev1',
            });
        });
        it('should process a message from an already created device', async function () {
            const res = await request(app)
                .post('/location/gpx')
                .query(gpxMessage)
                .send('');
            expect(res).to.have.status(200);
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('gpx');
            expect(wrapper.processLocation.args[0][2]).to.deep.equal(
                parse(gpxMessage),
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(gpxMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(1);
        });
    });

    describe('Process Locative device data', function () {
        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(vwr1);
        });
        it('should process a message from a new device', async function () {
            const res = await request(app)
                .post('/location/locative')
                .query(locDevMessage)
                .send('');
            expect(res).to.have.status(200);
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('locative');
            expect(wrapper.processLocation.args[0][2]).to.deep.equal(
                parse(locDevMessage),
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(locDevMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(1);
            expect(devices[0]).to.include({
                identifier: 'apikey-vwr1-ABCD-1234-ABCD-123456789ABC',
                alias: 'apikey-vwr1-ABCD-1234-ABCD-123456789ABC',
            });
        });
        it('should process a message from an already created device', async function () {
            const res = await request(app)
                .post('/location/locative')
                .query(locDevMessage)
                .send('');
            expect(res).to.have.status(200);
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('locative');
            expect(wrapper.processLocation.args[0][2]).to.deep.equal(
                parse(locDevMessage),
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(locDevMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(1);
        });
    });

    describe('Process Locative tag data', function () {
        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(vwr1);
        });
        it('should process a message from a new device', async function () {
            const res = await request(app)
                .post('/location/locative')
                .query(locTagMessage)
                .send('');
            expect(res).to.have.status(200);
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('locative');
            expect(wrapper.processLocation.args[0][2]).to.deep.equal(
                parse(locTagMessage),
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(locTagMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(2);
            expect(
                subset(devices, ['identifier', 'alias']),
            ).to.include.deep.members([
                {
                    identifier: 'apikey-vwr1-ABCD-1234-ABCD-123456789ABC',
                    alias: 'apikey-vwr1-ABCD-1234-ABCD-123456789ABC',
                },
                { identifier: 'tag1', alias: 'tag1' },
            ]);
        });
        it('should process a message from an already created device', async function () {
            const res = await request(app)
                .post('/location/locative')
                .query(locTagMessage)
                .send('');
            expect(res).to.have.status(200);
            expect(wrapper.processLocation.calledOnce).to.equal(true);
            expect(wrapper.processLocation.args[0][1]).to.equal('locative');
            expect(wrapper.processLocation.args[0][2]).to.deep.equal(
                parse(locTagMessage),
            );
            const processed = await wrapper.processLocation.returnValues[0];
            expect(processed).to.include(locTagMessageProcessed);
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(2);
        });
    });
});
