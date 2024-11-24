import Aedes from 'aedes';
import mqtt from 'mqtt';
import { createServer } from 'node:net';
import * as mqttService from '../../src/services/mqtt.js';

export function createMqttServer(port) {
    return new Promise(function (resolve, reject) {
        try {
            const aedes = Aedes();
            const mqttServer = createServer(aedes.handle);

            mqttServer.on('close', function () {
                // Aedes should be closed also because otherwise mocha will not exit
                aedes.close();
            });

            mqttServer.on('error', function (err) {
                reject(err);
            });

            aedes.on('subscribe', function (packet, _client) {
                console.log(`Subscribe qos ${packet[0].qos}`);
            });

            aedes.on('publish', function (packet, _client) {
                console.log(`Publish: ${packet.payload}`);
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

// export async function publishMessage(client, topic, message) {
//     console.log('Start publishMessage');
//     await client.publishAsync(topic, message, { qos: 2 });
//     console.log('End publishMessage');
// }

export function publishMessage(client, topic, message) {
    console.log('Start publishMessage');
    return new Promise(function (resolve, reject) {
        client.publish(topic, message, { qos: 2 }, function (err, _packet) {
            if (err) {
                reject(err);
            } else {
                console.log('End publishMessage');
                resolve();
            }
        });
    });
}
