import { expect } from 'chai';
import { spy } from 'sinon';
import { addUserAndDevices, removeUserAndDevices } from './helpers/database.js';
import {
    createMqttClient,
    createMqttServer,
    destroyMqttServer,
    publishMessage,
} from './helpers/mqtt.js';
import * as mqttService from '../services/mqtt.js';
//import { processLocation } from '../utils/ingester.js';

const testMessage =
    '{"id":"test2", "apikey":"12345678", "timestamp":"2024-05-10T15:14:31.191Z", "lat":"32.123", "lon":"-110.123"}';

const testMessageProcessed = {
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
    let mqttTestClient;
    let mqttServiceClient;
    const onMessageSpy = spy(mqttService.onMessage);

    before(async function () {
        // Create a test user and add test devices
        await addUserAndDevices(testUser, [testDevice]);
        // Create a local MQTT server
        mqttServer = await createMqttServer(mqttService.getBrokerUrl().port);
        // Start the MQTT client service
        mqttServiceClient = mqttService.start(onMessageSpy);
        // Start an MQTT test client
        mqttTestClient = createMqttClient();
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
    });

    afterEach(function () {
        onMessageSpy.resetHistory();
    });

    describe('Process an MQTT message', function () {
        it('should successfully process the received message', async function () {
            await publishMessage(
                mqttTestClient,
                mqttServiceClient,
                'livemap/test',
                testMessage,
            );
            expect(onMessageSpy.calledOnce).to.equal(true);
            expect(onMessageSpy.args[0][0]).to.equal('livemap/test');
            expect(onMessageSpy.args[0][1].toString()).to.equal(testMessage);
            const processed = await onMessageSpy.returnValues[0];
            expect(processed).to.include(testMessageProcessed);
        });
    });
});
