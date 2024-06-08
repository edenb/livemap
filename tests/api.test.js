import { expect } from 'chai';
import express from 'express';
import session from 'express-session';
import { request, subset } from './helpers/chai.js';
import {
    addPosition,
    addShare,
    addUserAndDevices,
    getDevices,
    getUser,
    removeUserAndDevices,
} from './helpers/database.js';
import {
    adm1Auth,
    adm1,
    adm1Devs,
    man1Auth,
    man1,
    man1Devs,
    vwr1Auth,
    vwr1,
    vwr1Devs,
    vwr2Auth,
    vwr2,
    vwr3Auth,
    vwr3,
    devPositions,
} from './helpers/fixtures.js';
import {
    addRouter,
    createWebServer,
    destroyWebServer,
} from './helpers/webserver.js';
import passport from '../src/auth/passport.js';
import { bindStore, getStore } from '../src/database/db.js';
import routesApi from '../src/routes/api.js';

describe('REST API', function () {
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
        // Start a webserver
        webServer = await createWebServer(app, 3000);
        addRouter(app, '/api/v1', routesApi(passport));
    });

    after(async function () {
        // Destroy the webserver
        await destroyWebServer(webServer);
    });

    describe('Anonymous user', function () {
        describe('GET /', function () {
            it('should respond that the API is available', async function () {
                const res = await request(app).get('/api/v1').send();
                expect(res).have.status(200);
                expect(res).to.be.html;
                expect(res.body).to.be.empty;
                expect(res.text).to.equal('API V1 is up');
            });
        });

        describe('GET /a-path', function () {
            it('should respond with 404 on a non exiting path', async function () {
                const res = await request(app).get('/api/v1/a-path').send();
                expect(res).have.status(404);
                expect(res.text).to.equal('Invalid endpoint');
            });
        });

        describe('GET /login', function () {
            it('should respond with 404 without username/password', async function () {
                const res = await request(app).get('/api/v1/login').send();
                expect(res).have.status(404);
            });
            it('should respond with 404 with invalid username/password', async function () {
                const res = await request(app).get('/api/v1/login').send();
                expect(res).have.status(404);
            });
        });

        describe('OPTIONS /', function () {
            it('should respond with 200 on OPTION method', async function () {
                const res = await request(app).options('/api/v1').send();
                expect(res).have.status(200);
            });
        });
    });

    describe('Admin user', function () {
        let token;

        beforeEach(async function () {
            // Add 3 users and their devices
            await addUserAndDevices({ ...adm1Auth, ...adm1 }, adm1Devs);
            await addUserAndDevices({ ...man1Auth, ...man1 }, man1Devs);
            await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, vwr1Devs);
            await addUserAndDevices({ ...vwr2Auth, ...vwr2 }, []);
            // Login as admin user
            const data = {
                username: adm1.username,
                password: adm1Auth.password,
            };
            const res = await request(app)
                .post('/api/v1/login')
                .type('json')
                .send(data);
            token = res.body.access_token;
        });

        afterEach(async function () {
            // Remove the admin user and its owned devices
            await removeUserAndDevices(adm1);
            await removeUserAndDevices(man1);
            await removeUserAndDevices(vwr1);
            await removeUserAndDevices(vwr2);
            await removeUserAndDevices(vwr3);
        });

        describe('GET /account', function () {
            it('should respond with account details', async function () {
                const res = await request(app)
                    .get('/api/v1/account')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                expect(res.body).to.include(adm1);
            });
        });

        describe('GET /users', function () {
            it('should get all users details', async function () {
                const res = await request(app)
                    .get('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                // const users = res.body.map(
                //     ({ user_id, ...remainingAttrs }) => remainingAttrs,
                // );
                const users = subset(res.body, Object.keys(adm1));
                expect(users).to.include.deep.members([adm1, man1, vwr1]);
            });
        });

        describe('POST /users', function () {
            it('should add a new user', async function () {
                const data = { ...vwr3Auth, ...vwr3 };
                const res = await request(app)
                    .post('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(201);
            });
        });

        describe('PUT /users/:userId', function () {
            it('should change the account details of a user', async function () {
                const user = await getUser(vwr1);
                const data = {
                    username: 'vwr1',
                    fullname: 'Viewer 1 modified',
                    email: 'viewer1modified@example.com',
                    role: 'viewer',
                    api_key: 'apikey-vwr1',
                };
                const res = await request(app)
                    .put('/api/v1/users/' + user.user_id)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(204);
                const modifiedUser = await getUser(vwr1);
                expect(modifiedUser).to.include(data);
            });
        });

        describe('GET /users/:userId', function () {
            it('should get details about a user', async function () {
                const user = await getUser(vwr1);
                const res = await request(app)
                    .get('/api/v1/users/' + user.user_id)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                expect(res.body[0]).to.include(vwr1);
            });
        });

        describe('POST /users/:userId/password/change', function () {
            it('should change your own password', async function () {
                const user = await getUser(adm1);
                const data = {
                    curpwd: adm1Auth.password,
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                };
                const res = await request(app)
                    .post('/api/v1/users/' + user.user_id + '/password/change')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(201);
                const modifiedUser = await getUser(adm1);
                expect(modifiedUser.password).to.not.equal(user.password);
            });
            it('should respond with 403 on other users', async function () {
                const user = await getUser(vwr1);
                const data = {
                    curpwd: vwr1Auth.password,
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                };
                const res = await request(app)
                    .post('/api/v1/users/' + user.user_id + '/password/change')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(403);
            });
        });

        describe('POST /users/:userId/password/reset', function () {
            it('should change the password of a user', async function () {
                const user = await getUser(vwr1);
                const data = {
                    curpwd: vwr1Auth.password,
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                };
                const res = await request(app)
                    .post('/api/v1/users/' + user.user_id + '/password/reset')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(201);
                const modifiedUser = await getUser(vwr1);
                expect(modifiedUser.password).to.not.equal(user.password);
            });
            it('should respond with 403 if user does not exist', async function () {
                const data = {
                    curpwd: vwr1Auth.password,
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                };
                const res = await request(app)
                    .post('/api/v1/users/0/password/change')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(403);
            });
        });

        describe('DELETE /users/:userId', function () {
            it('should delete a user', async function () {
                const user = await getUser(vwr2);
                const res = await request(app)
                    .delete('/api/v1/users/' + user.user_id)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(204);
                const deletedUser = await getUser(vwr2);
                expect(deletedUser).to.be.null;
            });
            it('should respond with 400 when deleting own account', async function () {
                const user = await getUser(adm1);
                const res = await request(app)
                    .delete('/api/v1/users/' + user.user_id)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(400);
                const deletedUser = await getUser(adm1);
                expect(deletedUser).to.include(adm1);
            });
        });

        describe('GET /users/:userId/devices', function () {
            it('should get all devices of a user', async function () {
                const user = await getUser(adm1);
                const res = await request(app)
                    .get('/api/v1/users/' + user.user_id + '/devices')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                const devices = subset(res.body, Object.keys(adm1Devs[0]));
                expect(devices).to.eql(adm1Devs);
            });
        });

        describe('POST /users/:userId/devices', function () {
            it('should add a new device', async function () {
                const user = await getUser(vwr1);
                const data = {
                    identifier: 'vwr1Dev2',
                    alias: 'Viewer 1 device 2',
                    fixed_loc_lat: 40.7,
                    fixed_loc_lon: -73.9,
                };
                const res = await request(app)
                    .post('/api/v1/users/' + user.user_id + '/devices')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(201);
                const addedDevices = await getDevices(adm1);
                const devices = subset(addedDevices, Object.keys(data));
                expect(devices).to.include.deep.members([data]);
            });
        });

        describe('PUT /users/:userId/devices/:deviceId', function () {
            it('should change the attributes of a device', async function () {
                const user = await getUser(adm1);
                const orgDevices = await getDevices(adm1);
                const data = {
                    device_id: orgDevices[0].device_id,
                    alias: 'Admin 1 device 1 modified',
                    fixed_loc_lat: 51.8,
                    fixed_loc_lon: -84,
                };
                const res = await request(app)
                    .put(
                        '/api/v1/users/' +
                            user.user_id +
                            '/devices/' +
                            orgDevices[0].device_id,
                    )
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(204);
                const modifiedDevices = await getDevices(adm1);
                const devices = subset(modifiedDevices, Object.keys(data));
                expect(devices).to.include.deep.members([data]);
            });
            it('should respond with 404 if the device does not exist', async function () {
                const user = await getUser(adm1);
                const data = {
                    device_id: -1,
                    alias: 'Admin 1 device 1 modified',
                    fixed_loc_lat: 51.8,
                    fixed_loc_lon: -84,
                };
                const res = await request(app)
                    .put('/api/v1/users/' + user.user_id + '/devices/-1')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(404);
            });
        });

        describe('DELETE /users/:userId/devices/:deviceIds', function () {
            it('should delete all devices of a user', async function () {
                const user = await getUser(adm1);
                const devices = await getDevices(adm1);
                const ids = devices.map(({ device_id }) => device_id);
                const res = await request(app)
                    .delete('/api/v1/users/' + user.user_id + '/devices/' + ids)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(204);
                const deletedDevices = await getDevices(adm1);
                expect(deletedDevices).to.be.empty;
            });
            it('should respond with 404 if non of the devices exist', async function () {
                const user = await getUser(adm1);
                const ids = [-1, -2];
                const res = await request(app)
                    .delete('/api/v1/users/' + user.user_id + '/devices/' + ids)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(404);
            });
        });

        describe('POST /users/:userId/devices/:deviceIds/shareduser', function () {
            it('should add a shared user to a list of devices', async function () {
                const user = await getUser(adm1);
                const orgDevices = await getDevices(adm1);
                const ids = orgDevices.map(({ device_id }) => device_id);
                const data = vwr1;
                const res = await request(app)
                    .post(
                        '/api/v1/users/' +
                            user.user_id +
                            '/devices/' +
                            ids +
                            '/shareduser',
                    )
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).have.status(201);
                const sharedDevices = await getDevices(vwr1);
                const devices = subset(sharedDevices, Object.keys(vwr1Devs[0]));
                expect(devices).to.include.deep.members([
                    ...vwr1Devs,
                    ...adm1Devs,
                ]);
            });
        });

        describe('DELETE /users/:userId/devices/:deviceIds/shareduser', function () {
            it('should delete a shared user from a list of devices', async function () {
                const user = await getUser(adm1);
                const orgDevices = await getDevices(adm1);
                const ids = orgDevices.map(({ device_id }) => device_id);
                await addShare(vwr1, ids);
                const res = await request(app)
                    .delete(
                        '/api/v1/users/' +
                            user.user_id +
                            '/devices/' +
                            ids +
                            '/shareduser',
                    )
                    .auth(token, { type: 'bearer' })
                    .send(vwr1);
                expect(res).have.status(204);
                const sharedDevices = await getDevices(vwr1);
                const devices = subset(sharedDevices, Object.keys(vwr1Devs[0]));
                expect(devices).to.not.include.deep.members([...adm1Devs]);
            });
        });

        describe('GET /devices', function () {
            it('should get all devices', async function () {
                const res = await request(app)
                    .get('/api/v1/devices')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                const devices = subset(res.body, Object.keys(vwr1Devs[0]));
                expect(devices).to.include.deep.members([
                    ...vwr1Devs,
                    ...man1Devs,
                    ...adm1Devs,
                ]);
            });
        });

        describe('GET /positions', function () {
            it('should get all latest positions from devices of a user', async function () {
                const devices = await getDevices(adm1);
                const orgPosition = {
                    ...devPositions[0],
                    device_id: devices[0].device_id,
                };
                await addPosition(orgPosition);
                const res = await request(app)
                    .get('/api/v1/positions')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                expect(res.body[0]).to.include(orgPosition);
            });
        });

        describe('GET /staticlayers', function () {
            it('should get all static layers', async function () {
                const res = await request(app)
                    .get('/api/v1/staticlayers')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                expect(res.body).to.be.an('array');
                res.body.forEach(function (geojson) {
                    expect(geojson)
                        .to.be.an('object')
                        .that.has.any.keys('type');
                });
            });
        });

        describe('GET /server/info', function () {
            it('should get information about the server', async function () {
                const res = await request(app)
                    .get('/api/v1/server/info')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).have.status(200);
                expect(res.body).to.be.an('object');
            });
        });
    });
});
