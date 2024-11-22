import { expect } from 'chai';
import { spy } from 'sinon';
import {
    createMqttClient,
    createMqttServer,
    destroyMqttServer,
    publishMessage,
} from './helpers/mqtt.js';
import * as mqttService from '../src/services/mqtt.js';

const testMessage =
    '{"id":"test2", "apikey":"12345678", "timestamp":"2024-05-10T15:14:31.191Z", "lat":"32.123", "lon":"-110.123"}';

describe('MQTT service', function () {
    const callbackSpy = spy();
    let mqttServer;
    let mqttServiceClient;
    let mqttTestClient;

    before(async function () {
        // Create a local MQTT server
        mqttServer = await createMqttServer(mqttService.getBrokerUrl().port);
        // Start the MQTT client service
        mqttServiceClient = mqttService.start(callbackSpy);
        // Start an MQTT test client
        mqttTestClient = createMqttClient();
    });

    after(async function () {
        // Remove the MQTT test client
        await mqttTestClient.endAsync();
        // Remove the MQTT client service
        await mqttServiceClient.endAsync();
        // Destroy the local MQTT server
        await destroyMqttServer(mqttServer);
    });

    afterEach(function () {
        callbackSpy.resetHistory();
    });

    describe('Publish a message with livemap topic', function () {
        it('should receive the published message', async function () {
            await publishMessage(mqttTestClient, 'livemap/test', testMessage);
            // Wait until MQTT message is processed
            await Promise.all(callbackSpy.returnValues);
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('mqtt');
            expect(callbackSpy.args[0][2].toString()).to.equal(testMessage);
        });
    });
});
