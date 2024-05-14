import Aedes from 'aedes';
import { expect } from 'chai';
import mqtt from 'mqtt';
import { createServer } from 'node:net';
import { createSandbox } from 'sinon';
//import { queryDbAsync } from '../database/db.js';
import * as mqttService from '../services/mqtt.js';

// const testUser = {
//     username: 'testuser1',
//     fullName: 'Test User 1',
//     email: 'test@user1',
//     role: 'viewer',
//     api_key: '12345678',
//     password: 'testuser1',
// };

// const testDevice = {
//     identifier: 'testdevice1',
//     alias: 'Test device 1',
//};

const testMessage =
    '{"id":"test2", "apikey":"12345678", "timestamp":"2024-05-10T15:14:31.191Z", "lat":"32.123", "lon":"-110.123"}';

function createMqttServer(port) {
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

function destroyMqttServer(mqttServer) {
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

function createMqttClient() {
    return mqtt.connect(mqttService.getBrokerUrl().href, {
        keepalive: 10,
    });
}

async function publishMessage(client, topic, message) {
    await client.publishAsync(topic, message, { qos: 2 });
}

describe('MQTT service', function () {
    let mqttServer;
    let mqttTestClient;
    let mqttServiceClient;
    const sandbox = createSandbox();
    const spy = sandbox.spy();
    //let user_id;

    this.timeout(500);

    before(async function () {
        try {
            // Create a local MQTT server
            mqttServer = await createMqttServer(
                mqttService.getBrokerUrl().port,
            );
            // Start the MQTT client service
            mqttServiceClient = mqttService.start(spy);
            // Start an MQTT test client
            mqttTestClient = createMqttClient();
        } catch (err) {
            throw new Error(err.message);
        }
    });

    after(async function () {
        try {
            // Remove the MQTT test client
            await mqttTestClient.endAsync();
            // Remove the MQTT client service
            await mqttServiceClient.endAsync();
            // Destroy the local MQTT server
            await destroyMqttServer(mqttServer);
        } catch (err) {
            throw new Error(err.message);
        }
    });

    afterEach(function () {
        sandbox.resetHistory();
    });

    // describe('Create a new test user', function () {
    //     it('should create 1 user', async function () {
    //         try {
    //             let queryRes;
    //             queryRes = await queryDbAsync('getUserByUsername', [
    //                 testUser.username,
    //             ]);
    //             // If the test user already exists use that one
    //             if (queryRes.rowCount === 1) {
    //                 user_id = queryRes.rows[0].user_id;
    //             } else {
    //                 queryRes = await queryDbAsync('insertUser', [
    //                     testUser.username,
    //                     testUser.fullName,
    //                     testUser.email,
    //                     testUser.role,
    //                     testUser.api_key,
    //                     testUser.password,
    //                 ]);
    //                 queryRes = await queryDbAsync('getUserByUsername', [
    //                     testUser.username,
    //                 ]);
    //                 if (queryRes.rowCount === 1) {
    //                     user_id = queryRes.rows[0].user_id;
    //                 }
    //             }
    //         } catch (err) {
    //             throw new Error(err.message);
    //         }
    //     });
    // });

    // describe('Setup a device for the test user', function () {
    //     it('should create 1 device', async function () {
    //         try {
    //             const queryRes = await queryDbAsync('insertDevice', [
    //                 testUser.api_key,
    //                 testDevice.identifier,
    //                 testDevice.alias,
    //             ]);
    //             expect(queryRes.rowCount).to.equal(1);
    //         } catch (err) {
    //             throw new Error(err.message);
    //         }
    //     });
    // });

    describe('Publish a message with livemap topic', function () {
        it('should receive the published message', async function () {
            try {
                await publishMessage(
                    mqttTestClient,
                    'livemap/test',
                    testMessage,
                );
                expect(spy.calledOnce).to.equal(true);
                expect(spy.args[0][0]).to.equal('livemap/test');
                expect(spy.args[0][1].toString()).to.equal(testMessage);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });

    // describe('Remove all test devices for the test user', function () {
    //     it('should delete all test devices', async function () {
    //         try {
    //             let queryRes;
    //             queryRes = await queryDbAsync('getOwnedDevicesByUserId', [
    //                 user_id,
    //             ]);
    //             if (queryRes.rowCount > 0) {
    //                 const testDevices = queryRes.rows.map(
    //                     ({ device_id }) => device_id,
    //                 );
    //                 queryRes = await queryDbAsync('deleteDevicesByUserId', [
    //                     user_id,
    //                     testDevices,
    //                 ]);
    //             }
    //         } catch (err) {
    //             throw new Error(err.message);
    //         }
    //     });
    // });

    // describe('Remove test user', function () {
    //     it('should delete 1 user', async function () {
    //         try {
    //             const queryRes = await queryDbAsync('deleteUser', [user_id]);
    //         } catch (err) {
    //             throw new Error(err.message);
    //         }
    //     });
    // });
});
