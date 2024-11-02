import { expect } from 'chai';
import { spy } from 'sinon';
import { agent, request } from './helpers/chai.js';
import {
    addUserAndDevices,
    getDevices,
    removeUserAndDevices,
} from './helpers/database.js';
import {
    adm1Auth,
    adm1,
    adm1Devs,
    vwr1Auth,
    vwr1,
    devPositions,
} from './helpers/fixtures.js';
import { createLiveClient, destroyLiveClient, sleep } from './helpers/live.js';
import { createWebServer } from './helpers/webserver.js';
import App from '../src/app.js';
import * as liveServer from '../src/services/liveserver.js';

describe('Live server', function () {
    const app = App();
    let loginAdm1;
    let loginVwr1;
    let position;
    let server;
    let tokenAdm1;
    let tokenVwr1;
    let webServer;

    before(async function () {
        // Start a webserver and a live server
        webServer = await createWebServer(app, 3001);
        server = liveServer.start(webServer);
        // Create test users and add test devices
        await addUserAndDevices({ ...adm1, ...adm1Auth }, adm1Devs);
        await addUserAndDevices({ ...vwr1, ...vwr1Auth }, []);
        // Get token of user: adm1
        loginAdm1 = {
            username: adm1.username,
            password: adm1Auth.password,
        };
        // Get token of user: vwr1
        loginVwr1 = {
            username: vwr1.username,
            password: vwr1Auth.password,
        };
        // Create a position for a device owned by adm1
        const devices = await getDevices(adm1);
        position = {
            ...devPositions[0],
            device_id: devices[0].device_id,
            api_key: adm1.api_key,
        };
    });
    after(async function () {
        // Destroy the live server and the webserver
        server.close();
        await removeUserAndDevices(adm1);
        await removeUserAndDevices(vwr1);
    });

    describe('Broadcast positions to token authorized clients (auth by event)', async function () {
        let client1, client2, client3;
        let callbackSpy1 = spy(),
            callbackSpy2 = spy(),
            callbackSpy3 = spy();

        before(async function () {
            const res1 = await request(app)
                .post('/api/v1/login')
                .type('json')
                .send(loginAdm1);
            tokenAdm1 = res1.body.access_token;
            const res2 = await request(app)
                .post('/api/v1/login')
                .type('json')
                .send(loginVwr1);
            tokenVwr1 = res2.body.access_token;
            client1 = await createLiveClient(
                'http://localhost:3001',
                tokenAdm1,
                null,
                false,
                callbackSpy1,
            );
            client3 = await createLiveClient(
                'http://localhost:3001',
                tokenVwr1,
                null,
                false,
                callbackSpy3,
            );
        });
        after(async function () {
            await destroyLiveClient(client1);
            await destroyLiveClient(client2);
            await destroyLiveClient(client3);
        });

        describe('Existing authorized client 1', async function () {
            it('should receive the first position', async function () {
                await liveServer.sendToClients(position); // First position
                await sleep(100);
                expect(callbackSpy1.calledOnce).to.equal(true);
                const data = JSON.parse(callbackSpy1.args[0][0]).data;
                expect(data).to.eql(position);
            });
        });

        describe('A new authorized client 2', async function () {
            before(async function () {
                client2 = await createLiveClient(
                    'http://localhost:3001',
                    tokenAdm1,
                    null,
                    false,
                    callbackSpy2,
                );
            });
            it('should receive the second position', async function () {
                await liveServer.sendToClients(position); // Second position
                await sleep(100);
                expect(callbackSpy2.calledOnce).to.equal(true);
                const data = JSON.parse(callbackSpy2.args[0][0]).data;
                expect(data).to.eql(position);
            });
        });

        describe('Existing authorized client 1', async function () {
            it('should receive the second position', async function () {
                expect(callbackSpy1.calledTwice).to.equal(true);
                const data = JSON.parse(callbackSpy1.args[1][0]).data;
                expect(data).to.eql(position);
            });
        });

        describe('An unauthorized client 3', async function () {
            it('should not receive any positions', async function () {
                expect(callbackSpy3.callCount).to.equal(0);
            });
        });

        describe('A position with an invalid device id', async function () {
            let invalidPosition;
            before(async function () {
                invalidPosition = {
                    ...devPositions[0],
                    device_id: -1,
                    api_key: adm1.api_key,
                };
            });
            it('should not be received by any client', async function () {
                callbackSpy1.resetHistory();
                callbackSpy2.resetHistory();
                callbackSpy3.resetHistory();
                await liveServer.sendToClients(invalidPosition);
                await sleep(100);
                expect(callbackSpy1.callCount).to.equal(0);
                expect(callbackSpy2.callCount).to.equal(0);
                expect(callbackSpy3.callCount).to.equal(0);
            });
        });
    });

    describe('Connection attempt with an unauthorized token (auth by event)', async function () {
        it('should throw an exception', async function () {
            try {
                await createLiveClient(
                    'http://localhost:3001',
                    'invalid-token',
                    null,
                    false,
                    null,
                );
                expect(true, 'promise should fail').eq(false);
            } catch (e) {
                expect(e.message).to.eq('Unauthorized');
            }
        });
    });

    describe('Broadcast positions to token authorized clients (auth by handshake)', async function () {
        let client1, client2, client3;
        let callbackSpy1 = spy(),
            callbackSpy2 = spy(),
            callbackSpy3 = spy();

        before(async function () {
            const res1 = await request(app)
                .post('/api/v1/login')
                .type('json')
                .send(loginAdm1);
            tokenAdm1 = res1.body.access_token;
            const res2 = await request(app)
                .post('/api/v1/login')
                .type('json')
                .send(loginVwr1);
            tokenVwr1 = res2.body.access_token;
            client1 = await createLiveClient(
                'http://localhost:3001',
                tokenAdm1,
                null,
                true,
                callbackSpy1,
            );
            client3 = await createLiveClient(
                'http://localhost:3001',
                tokenVwr1,
                null,
                true,
                callbackSpy3,
            );
        });
        after(async function () {
            await destroyLiveClient(client1);
            await destroyLiveClient(client2);
            await destroyLiveClient(client3);
        });

        describe('Existing authorized client 1', async function () {
            it('should receive the first position', async function () {
                await liveServer.sendToClients(position); // First position
                await sleep(100);
                expect(callbackSpy1.calledOnce).to.equal(true);
                const data = JSON.parse(callbackSpy1.args[0][0]).data;
                expect(data).to.eql(position);
            });
        });

        describe('A new authorized client 2', async function () {
            before(async function () {
                client2 = await createLiveClient(
                    'http://localhost:3001',
                    tokenAdm1,
                    null,
                    true,
                    callbackSpy2,
                );
            });
            it('should receive the second position', async function () {
                await liveServer.sendToClients(position); // Second position
                await sleep(100);
                expect(callbackSpy2.calledOnce).to.equal(true);
                const data = JSON.parse(callbackSpy2.args[0][0]).data;
                expect(data).to.eql(position);
            });
        });

        describe('Existing authorized client 1', async function () {
            it('should receive the second position', async function () {
                expect(callbackSpy1.calledTwice).to.equal(true);
                const data = JSON.parse(callbackSpy1.args[1][0]).data;
                expect(data).to.eql(position);
            });
        });

        describe('An unauthorized client 3', async function () {
            it('should not receive any positions', async function () {
                expect(callbackSpy3.callCount).to.equal(0);
            });
        });

        describe('A position with an invalid device id', async function () {
            let invalidPosition;
            before(async function () {
                invalidPosition = {
                    ...devPositions[0],
                    device_id: -1,
                    api_key: adm1.api_key,
                };
            });
            it('should not be received by any client', async function () {
                callbackSpy1.resetHistory();
                callbackSpy2.resetHistory();
                callbackSpy3.resetHistory();
                await liveServer.sendToClients(invalidPosition);
                await sleep(100);
                expect(callbackSpy1.callCount).to.equal(0);
                expect(callbackSpy2.callCount).to.equal(0);
                expect(callbackSpy3.callCount).to.equal(0);
            });
        });
    });

    describe('Connection attempt with an unauthorized token (auth by handshake)', async function () {
        it('should throw an exception', async function () {
            try {
                await createLiveClient(
                    'http://localhost:3001',
                    'invalid-token',
                    null,
                    true,
                    null,
                );
                expect(true, 'promise should fail').eq(false);
            } catch (e) {
                expect(e.message).to.eq('Unauthorized');
            }
        });
    });

    describe('Broadcast positions to cookie authorized clients', async function () {
        let reqAgent;

        before(function () {
            // Create a request agent to retain cookies
            reqAgent = agent(app);
        });
        after(function () {
            // Destroy the request agent
            reqAgent.close();
        });

        describe('Existing authorized client', function () {
            let client;
            let callbackSpy = spy();

            before(async function () {
                const res = await reqAgent.post('/login').send(loginAdm1);
                client = await createLiveClient(
                    'http://localhost:3001',
                    null,
                    res.headers['set-cookie'][0],
                    false,
                    callbackSpy,
                );
            });
            after(async function () {
                await destroyLiveClient(client);
            });

            it('should receive the first position', async function () {
                await liveServer.sendToClients(position);
                await sleep(100);
                expect(callbackSpy.calledOnce).to.equal(true);
                const data = JSON.parse(callbackSpy.args[0][0]).data;
                expect(data).to.eql(position);
            });
        });
    });

    describe('Connection attempt with an unauthorized cookie', async function () {
        it('should throw an exception', async function () {
            try {
                await createLiveClient(
                    'http://localhost:3001',
                    null,
                    'connect.sid=invalid_cookie',
                    false,
                    null,
                );
                expect(true, 'promise should fail').eq(false);
            } catch (e) {
                expect(e.message).to.eq('Unauthorized');
            }
        });
    });
});
