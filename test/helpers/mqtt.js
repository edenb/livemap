import Aedes from 'aedes';
import mqtt from 'mqtt';
import { createServer } from 'node:net';
import * as mqttService from '../../services/mqtt.js';

export function createMqttServer(port) {
    return new Promise(function (resolve, reject) {
        try {
            const aedes = new Aedes();
            const mqttServer = createServer(aedes.handle);

            mqttServer.on('close', function () {
                // Aedes should be closed also because otherwise mocha will not exit
                aedes.close();
            });

            mqttServer.on('error', function (err) {
                reject(err);
            });

            mqttServer.listen(port, function () {
                resolve(mqttServer);
            });
        } catch (err) {
            reject(err);
        }
    });
}

export function destroyMqttServer(mqttServer) {
    return new Promise(function (resolve, reject) {
        try {
            mqttServer.close(function () {
                resolve();
            });
        } catch (err) {
            reject(err);
        }
    });
}

export function createMqttClient() {
    return mqtt.connect(mqttService.getBrokerUrl().href, {
        keepalive: 10,
    });
}

export function publishMessage(sendClient, receiveClient, topic, message) {
    return new Promise(function (resolve) {
        receiveClient.on('message', function () {
            resolve();
        });
        sendClient.publish(topic, message, { qos: 0 });
    });
}
