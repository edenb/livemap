import { expect } from 'chai';
import express from 'express';
import session from 'express-session';
import { spy } from 'sinon';
import { request } from './helpers/chai.js';
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
import { createLiveClient, destroyLiveClient } from './helpers/live.js';
import { addRouter, createWebServer } from './helpers/webserver.js';
import passport from '../src/auth/passport.js';
import { bindStore, getStore } from '../src/database/db.js';
import routesApi from '../src/routes/api.js';
import * as liveServer from '../src/services/liveserver.js';

describe('Live server', function () {
    let server;
    let tokenAdm1;
    let tokenVwr1;
    let webServer;
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    bindStore(session, 'memory');

    const sessionMiddleware = session({
        name: 'session',
        store: getStore(),
        secret: 'secret',
        cookie: { maxAge: 60, sameSite: 'strict' },
        resave: false,
        saveUninitialized: true,
        unset: 'keep',
    });
    app.use((req, res, next) => {
        return sessionMiddleware(req, res, next);
    });
    app.use(passport.session());

    before(async function () {
        // Start a webserver and a live server
        webServer = await createWebServer(app, 3001);
        addRouter(app, '/api/v1', routesApi(passport));
        server = liveServer.start(webServer);
        // Create test users and add test devices
        await addUserAndDevices({ ...adm1, ...adm1Auth }, adm1Devs);
        await addUserAndDevices({ ...vwr1, ...vwr1Auth }, []);
        // Get token of user: adm1
        const loginAdm1 = {
            username: adm1.username,
            password: adm1Auth.password,
        };
        const res1 = await request(app)
            .post('/api/v1/login')
            .type('json')
            .send(loginAdm1);
        tokenAdm1 = res1.body.access_token;
        // Get token of user: vwr11
        const loginVwr1 = {
            username: vwr1.username,
            password: vwr1Auth.password,
        };
        const res2 = await request(app)
            .post('/api/v1/login')
            .type('json')
            .send(loginVwr1);
        tokenVwr1 = res2.body.access_token;
    });

    after(async function () {
        // Destroy the live server and the webserver
        server.close();
        await removeUserAndDevices(adm1);
        await removeUserAndDevices(vwr1);
    });

    describe('Broadcast positions of a device to all authorized clients', async function () {
        let position;
        let client1, client2, client3;
        let callbackSpy1 = spy(),
            callbackSpy2 = spy(),
            callbackSpy3 = spy();
        before(async function () {
            const devices = await getDevices(adm1);
            position = {
                ...devPositions[0],
                device_id: devices[0].device_id,
                api_key: adm1.api_key,
            };
            client1 = await createLiveClient(
                'http://localhost:3001',
                tokenAdm1,
                callbackSpy1,
            );
            client3 = await createLiveClient(
                'http://localhost:3001',
                tokenVwr1,
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
                    callbackSpy2,
                );
            });
            it('should receive the second position', async function () {
                await liveServer.sendToClients(position); // Second position
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
                expect(callbackSpy1.callCount).to.equal(0);
                expect(callbackSpy2.callCount).to.equal(0);
                expect(callbackSpy3.callCount).to.equal(0);
            });
        });
    });

    describe('Connection attempt by an unauthorized client', async function () {
        it('should throw an exception', async function () {
            try {
                await createLiveClient(
                    'http://localhost:3001',
                    'invalid-token',
                    null,
                );
                expect(true, 'promise should fail').eq(false);
            } catch (e) {
                expect(e.message).to.eq('Unauthorized');
            }
        });
    });
});
