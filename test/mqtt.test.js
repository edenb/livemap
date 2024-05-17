import { expect } from 'chai';
import { spy } from 'sinon';
import {
    createMqttClient,
    createMqttServer,
    destroyMqttServer,
    publishMessage,
} from './helpers/mqtt.js';
import * as mqttService from '../services/mqtt.js';

const testMessage =
    '{"id":"test2", "apikey":"12345678", "timestamp":"2024-05-10T15:14:31.191Z", "lat":"32.123", "lon":"-110.123"}';

describe('MQTT service', function () {
    let mqttServer;
    let mqttTestClient;
    let mqttServiceClient;
    const callbackSpy = spy();

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
            try {
                await publishMessage(
                    mqttTestClient,
                    mqttServiceClient,
                    'livemap/test',
                    testMessage,
                );
                expect(callbackSpy.calledOnce).to.equal(true);
                expect(callbackSpy.args[0][0]).to.equal('livemap/test');
                expect(callbackSpy.args[0][1].toString()).to.equal(testMessage);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
});
