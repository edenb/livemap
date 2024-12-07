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

            aedes.on('subscribe', function (packet, client) {
                console.log(`Subscribe qos ${packet[0].qos} ${client.id}`);
            });

            aedes.on('publish', function (packet, client) {
                console.log(`Publish: ${packet.payload}`);
            });

            aedes.on('clientReady', function (client) {
                console.log(`clientReady: ${client.id}`);
            });

            mqttServer.listen(port, function () {
                console.log('MQTT server created');
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

export async function createMqttClient() {
    const client = await mqtt.connectAsync(mqttService.getBrokerUrl().href, {
        keepalive: 10,
    });
    console.log('MQTT test client created');
    return client;
}

// export async function publishMessage(client, topic, message) {
//     console.log('Start publishMessage');
//     await client.publishAsync(topic, message, { qos: 2 });
//     console.log('End publishMessage');
// }

function storePut() {
    console.log('storePut');
}

export async function publishMessage(client, topic, message) {
    console.log('Start publishMessage');
    return new Promise(function (resolve, reject) {
        client.publish(
            topic,
            message,
            { qos: 2, cbStorePut: storePut },
            function (err, packet) {
                console.log('callback packet =' + JSON.stringify(packet));
                if (err) {
                    reject(err);
                } else {
                    console.log('End publishMessage');
                    resolve();
                }
            },
        );
    });
}
