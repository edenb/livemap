import { expect } from 'chai';
import { spy } from 'sinon';
import { mqttMessage } from './helpers/fixtures.js';
import {
    createMqttClient,
    createMqttServer,
    destroyMqttServer,
    publishMessage,
} from './helpers/mqtt.js';
import * as mqttService from '../src/services/mqtt.js';

import { createWebServer, destroyWebServer } from './helpers/webserver.js';
import App from '../src/app.js';

// const testMessage =
//     '{"id":"test2", "apikey":"12345678", "timestamp":"2024-05-10T15:14:31.191Z", "lat":"32.123", "lon":"-110.123"}';

async function processLocation(_parentLogger, _format, _payload) {
    return new Promise(function (resolve) {
        console.log('Dummy called');
        resolve();
    });
}

describe.only('MQTT service', function () {
    const callbackSpy = spy(processLocation);
    let mqttServer;
    let mqttServiceClient;
    let mqttTestClient;

    let webServer;
    const app = App();

    before(async function () {
        // Create a local MQTT server
        mqttServer = await createMqttServer(mqttService.getBrokerUrl().port);
        // Start the MQTT client service
        mqttServiceClient = mqttService.start(callbackSpy);
        // Start an MQTT test client
        mqttTestClient = await createMqttClient();

        webServer = await createWebServer(app, 3001);
    });

    after(async function () {
        // Remove the MQTT test client
        await mqttTestClient.endAsync();
        // Remove the MQTT client service
        await mqttServiceClient.endAsync();
        // Destroy the local MQTT server
        await destroyMqttServer(mqttServer);

        await destroyWebServer(webServer);
    });

    // afterEach(function () {
    //     callbackSpy.resetHistory();
    // });

    describe('Publish a message with livemap topic', function () {
        it('should receive the published message', async function () {
            await publishMessage(
                mqttTestClient,
                mqttServiceClient,
                'livemap/test',
                mqttMessage,
            );
            // Wait until MQTT message is processed
            await Promise.all(callbackSpy.returnValues);
            //await callbackSpy();
            expect(callbackSpy.calledOnce).to.equal(true);
            expect(callbackSpy.args[0][1]).to.equal('mqtt');
            expect(callbackSpy.args[0][2].toString()).to.equal(mqttMessage);
        });
    });
});
