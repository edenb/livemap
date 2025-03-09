import { expect } from 'chai';
import { spy } from 'sinon';
import { request, subset } from './helpers/chai.js';
import {
    addUserAndDevices,
    getDevices,
    removeUserAndDevices,
} from './helpers/database.js';
import {
    gpxMessage,
    locDevMessage,
    locTagMessage,
    mqttMessage,
    vwr1Auth,
    vwr1,
} from './helpers/fixtures.js';
import {
    createMqttClient,
    createMqttServer,
    destroyMqttServer,
    publishMessage,
} from './helpers/mqtt.js';
import { createWebServer, destroyWebServer } from './helpers/webserver.js';
import App from '../src/app.js';
import * as mqttService from '../src/services/mqtt.js';
import { processLocation } from '../src/utils/ingester.js';

describe('Integrations', function () {
    const app = App();
    let mqttServer;
    let mqttServiceClient;
    let mqttTestClient;
    const processLocationSpy = spy(processLocation);
    let webServer;

    before(async function () {
        // Create a local MQTT server
        mqttServer = await createMqttServer(mqttService.getBrokerUrl().port);
        // Start the MQTT client service
        mqttServiceClient = mqttService.start(processLocationSpy);
        // Start an MQTT test client
        mqttTestClient = await createMqttClient();
        // Start a webserver
        webServer = await createWebServer(app, 3001);
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
            // Wait until MQTT message is processed
            await Promise.all(processLocationSpy.returnValues);
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
            // Wait until MQTT message is processed
            await Promise.all(processLocationSpy.returnValues);
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
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(1);
            expect(devices[0]).to.include({
                identifier: '01234567-ABCD-0123-ABCD-0123456789AB',
                alias: '01234567-ABCD-0123-ABCD-0123456789AB',
            });
        });
        it('should process a message from an already created device', async function () {
            const res = await request(app)
                .post('/location/locative')
                .query(locDevMessage)
                .send('');
            expect(res).to.have.status(200);
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
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(2);
            expect(
                subset(devices, ['identifier', 'alias']),
            ).to.include.deep.members([
                {
                    identifier: '01234567-ABCD-0123-ABCD-0123456789AB',
                    alias: '01234567-ABCD-0123-ABCD-0123456789AB',
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
            const devices = await getDevices(vwr1);
            expect(devices.length).to.equal(2);
        });
    });
});
