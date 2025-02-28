import { expect } from 'chai';
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
    adm1,
    adm1Auth,
    adm1Devs,
    man1,
    man1Auth,
    man1Devs,
    vwr1,
    vwr1Auth,
    vwr1Devs,
    vwr2,
    vwr2Auth,
    vwr2Devs,
    devPositions,
} from './helpers/fixtures.js';
import { createWebServer, destroyWebServer } from './helpers/webserver.js';
import App from '../src/app.js';

describe('REST API', function () {
    const app = App();
    let webServer;

    before(async function () {
        // Start a webserver
        webServer = await createWebServer(app, 3001);
    });

    after(async function () {
        // Destroy the webserver
        await destroyWebServer(webServer);
    });

    describe('Anonymous user', function () {
        describe('GET /', function () {
            it('should respond that the API is available', async function () {
                const res = await request(app).get('/api/v1').send();
                expect(res).to.have.status(200);
                expect(res).to.be.html;
                expect(res.body).to.be.empty;
                expect(res.text).to.equal('API V1 is up');
            });
        });

        describe('GET /a-path', function () {
            it('should respond with 404 on a non existing path', async function () {
                const res = await request(app).get('/api/v1/a-path').send();
                expect(res).to.have.status(404);
                expect(res.text).to.equal('Invalid endpoint');
            });
        });

        describe('GET /login', function () {
            it('should respond with 404 without username/password', async function () {
                const res = await request(app).get('/api/v1/login').send();
                expect(res).to.have.status(404);
            });
            it('should respond with 404 with invalid username/password', async function () {
                const res = await request(app).get('/api/v1/login').send();
                expect(res).to.have.status(404);
            });
        });

        describe('OPTIONS /', function () {
            it('should respond with 200 on OPTION method', async function () {
                const res = await request(app).options('/api/v1').send();
                expect(res).to.have.status(200);
            });
        });
    });

    describe('Admin user', function () {
        let token;

        beforeEach(async function () {
            // Add 2 users and their devices
            await addUserAndDevices({ ...adm1, ...adm1Auth }, adm1Devs);
            await addUserAndDevices({ ...vwr1, ...vwr1Auth }, vwr1Devs);
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
            // Remove users and their owned devices
            await removeUserAndDevices(adm1);
            await removeUserAndDevices(vwr1);
            await removeUserAndDevices(vwr2);
        });

        describe('GET /account', function () {
            it('should get account details', async function () {
                const res = await request(app)
                    .get('/api/v1/account')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(200);
                expect(res.body).to.include(adm1);
            });
            it('should respond with 401 if auth token is missing', async function () {
                const res = await request(app).get('/api/v1/account').send();
                expect(res).to.have.status(401);
            });
        });

        describe('GET /devices', function () {
            it('should get all devices', async function () {
                const res = await request(app)
                    .get('/api/v1/devices')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(200);
                const devices = subset(res.body, Object.keys(vwr1Devs[0]));
                expect(devices).to.include.deep.members([
                    ...vwr1Devs,
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
                expect(res).to.have.status(200);
                expect(res.body[0]).to.include(orgPosition);
            });
        });

        describe('GET /server/info', function () {
            it('should get information about the server', async function () {
                const res = await request(app)
                    .get('/api/v1/server/info')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(200);
                expect(res.body).to.eql({
                    application: {
                        name: 'Livemap name',
                        about: 'Livemap about',
                        license: 'Livemap license',
                    },
                    mqtt: {
                        url: 'mqtt://127.0.0.1',
                        port: '1883',
                    },
                });
            });
        });

        describe('GET /staticlayers', function () {
            it('should get all static layers', async function () {
                const res = await request(app)
                    .get('/api/v1/staticlayers')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(200);
                expect(res.body).to.be.an('array');
                res.body.forEach(function (geojson) {
                    expect(geojson)
                        .to.be.an('object')
                        .that.has.any.keys('type');
                });
            });
        });

        describe('GET /users', function () {
            it('should get all users details', async function () {
                const res = await request(app)
                    .get('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(200);
                expect(res.body).to.containSubset([adm1, vwr1]);
            });
            it('should respond with 401 if auth token is missing', async function () {
                const res = await request(app).get('/api/v1/users').send();
                expect(res).to.have.status(401);
            });
        });

        describe('POST /users', function () {
            it('should add a new user', async function () {
                const data = { ...vwr2Auth, ...vwr2 };
                const res = await request(app)
                    .post('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(201);
            });
            it('should add a new user with a generated api key', async function () {
                const data = { ...vwr2Auth, ...vwr2, api_key: null };
                const res = await request(app)
                    .post('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(201);
                const newUser = await getUser(data);
                expect(/^[0-9A-F]*$/.test(newUser.api_key)).to.be.true;
            });
            it('should respond with 422 if full name too short', async function () {
                const data = { ...vwr2Auth, ...vwr2, fullname: '2' };
                const res = await request(app)
                    .post('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
                expect(res.body.message).to.equal('Validation failed');
                expect(res.body.errors).to.containSubset([
                    {
                        message: 'Full name too short',
                    },
                ]);
            });
            it('should respond with 409 if api key already exists', async function () {
                const data = { ...vwr2Auth, ...vwr2, api_key: 'apikey-adm1' };
                const res = await request(app)
                    .post('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(409);
                expect(res.body.statusText).to.equal('Conflict');
                expect(res.body.message).to.include(
                    'duplicate key value violates unique constraint',
                );
            });
        });

        describe('GET /users/:userId', function () {
            it('should get details about a user', async function () {
                const user = await getUser(vwr1);
                const res = await request(app)
                    .get(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(200);
                expect(res.body[0]).to.include(vwr1);
            });
            it('should respond with 404 if user does not exist', async function () {
                const res = await request(app)
                    .get('/api/v1/users/2147483647')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(404);
            });
            it('should respond with 422 if userId is not a number', async function () {
                const res = await request(app)
                    .get('/api/v1/users/aaa')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(422);
            });
        });

        describe('PUT /users/:userId', function () {
            it('should change the account details of a user', async function () {
                const user = await getUser(vwr1);
                const data = {
                    ...vwr1,
                    email: 'viewer1modified@example.com',
                    fullname: 'Viewer 1 modified',
                };
                const res = await request(app)
                    .put(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(204);
                const modifiedUser = await getUser(vwr1);
                expect(modifiedUser).to.include(data);
            });
            it('should respond with 409 if api key changed', async function () {
                const user = await getUser(vwr1);
                const data = {
                    ...vwr1,
                    api_key: 'aaa',
                    email: 'viewer1modified@example.com',
                    fullname: 'Viewer 1 modified',
                };
                const res = await request(app)
                    .put(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(409);
            });
            it('should respond with 404 if user does not exist', async function () {
                const data = {
                    ...vwr1,
                    email: 'viewer1modified@example.com',
                    fullname: 'Viewer 1 modified',
                };
                const res = await request(app)
                    .put('/api/v1/users/2147483647')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(404);
            });
            it('should respond with 422 if userId too large', async function () {
                const data = {
                    ...vwr1,
                    email: 'viewer1modified@example.com',
                    fullname: 'Viewer 1 modified',
                };
                const res = await request(app)
                    .put('/api/v1/users/9999999999')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
            });
            it('should respond with 422 if userId is not an integer', async function () {
                const data = {
                    ...vwr1,
                    email: 'viewer1modified@example.com',
                    fullname: 'Viewer 1 modified',
                };
                const res = await request(app)
                    .put('/api/v1/users/42.42')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
            });
            it('should respond with 422 if userId is not a number', async function () {
                const data = {
                    ...vwr1,
                    email: 'viewer1modified@example.com',
                    fullname: 'Viewer 1 modified',
                };
                const res = await request(app)
                    .put('/api/v1/users/aaa')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
            });
        });

        describe('DELETE /users/:userId', function () {
            it('should delete a user without devices', async function () {
                await addUserAndDevices({ ...vwr2, ...vwr2Auth }, []);
                const user = await getUser(vwr2);
                const res = await request(app)
                    .delete(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(204);
                const deletedUser = await getUser(vwr2);
                expect(deletedUser).to.be.null;
            });
            it('should respond with 409 if user owns devices', async function () {
                await addUserAndDevices({ ...vwr2, ...vwr2Auth }, vwr2Devs);
                const user = await getUser(vwr2);
                const res = await request(app)
                    .delete(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'bearer' })
                    .send();
                await removeUserAndDevices(vwr2);
                expect(res).to.have.status(409);
            });
            it('should respond with 404 if user does not exist', async function () {
                const res = await request(app)
                    .delete('/api/v1/users/2147483647')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(404);
            });
            it('should respond with 422 when deleting own account', async function () {
                const user = await getUser(adm1);
                const res = await request(app)
                    .delete(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(422);
                const deletedUser = await getUser(adm1);
                expect(deletedUser).to.include(adm1);
            });
            it('should respond with 422 if userId is not a number', async function () {
                const res = await request(app)
                    .delete('/api/v1/users/aaa')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(422);
            });
        });

        describe('GET /users/:userId/devices', function () {
            it('should get all devices of a user', async function () {
                const user = await getUser(adm1);
                const res = await request(app)
                    .get(`/api/v1/users/${user.user_id}/devices`)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(200);
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
                    .post(`/api/v1/users/${user.user_id}/devices`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(201);
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
                        `/api/v1/users/${user.user_id}/devices/${orgDevices[0].device_id}`,
                    )
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(204);
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
                    .put(`/api/v1/users/${user.user_id}/devices/-1`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(404);
            });
        });

        describe('DELETE /users/:userId/devices/:deviceIds', function () {
            it('should delete all devices of a user', async function () {
                const user = await getUser(adm1);
                const devices = await getDevices(adm1);
                const ids = devices.map(({ device_id }) => device_id);
                const res = await request(app)
                    .delete(`/api/v1/users/${user.user_id}/devices/${ids}`)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(204);
                const deletedDevices = await getDevices(adm1);
                expect(deletedDevices).to.be.empty;
            });
            it('should respond with 404 if non of the devices exist', async function () {
                const user = await getUser(adm1);
                const ids = [-1, -2];
                const res = await request(app)
                    .delete(`/api/v1/users/${user.user_id}/devices/${ids}`)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(404);
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
                        `/api/v1/users/${user.user_id}/devices/${ids}/shareduser`,
                    )
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(201);
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
                        `/api/v1/users/${user.user_id}/devices/${ids}/shareduser`,
                    )
                    .auth(token, { type: 'bearer' })
                    .send(vwr1);
                expect(res).to.have.status(204);
                const sharedDevices = await getDevices(vwr1);
                const devices = subset(sharedDevices, Object.keys(vwr1Devs[0]));
                expect(devices).to.not.include.deep.members([...adm1Devs]);
            });
        });

        describe('POST /users/:userId/password/change', function () {
            it('should change your own password', async function () {
                const user = await getUser(adm1);
                const data = {
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                    currentpwd: adm1Auth.password,
                };
                const res = await request(app)
                    .post(`/api/v1/users/${user.user_id}/password/change`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(201);
            });
            it('should change password of other users', async function () {
                const user = await getUser(vwr1);
                const data = {
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                    currentpwd: vwr1Auth.password,
                };
                const res = await request(app)
                    .post(`/api/v1/users/${user.user_id}/password/change`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(201);
            });
            it('should respond with 422 if given current password is incorrect', async function () {
                const user = await getUser(vwr1);
                const data = {
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                    currentpwd: 'wrong current password',
                };
                const res = await request(app)
                    .post(`/api/v1/users/${user.user_id}/password/change`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
                expect(res.body.errors).to.containSubset([
                    {
                        message: 'User and password do not match',
                    },
                ]);
            });
        });

        describe('POST /users/:userId/password/reset', function () {
            it('should change the password of a user', async function () {
                const user = await getUser(vwr1);
                const data = {
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                };
                const res = await request(app)
                    .post(`/api/v1/users/${user.user_id}/password/reset`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(201);
            });
            it('should respond with 404 if user does not exist', async function () {
                const data = {
                    newpwd: 'my modified password',
                    confirmpwd: 'my modified password',
                };
                const res = await request(app)
                    .post('/api/v1/users/2147483647/password/reset')
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(404);
            });
            it('should respond with 422 if password is empty', async function () {
                const user = await getUser(vwr1);
                const data = {
                    newpwd: '',
                    confirmpwd: '',
                };
                const res = await request(app)
                    .post(`/api/v1/users/${user.user_id}/password/reset`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
                expect(res.body.errors).to.containSubset([
                    {
                        message: 'No password',
                    },
                ]);
            });
            it('should respond with 422 if password too short', async function () {
                const user = await getUser(vwr1);
                const data = {
                    newpwd: 'pw',
                    confirmpwd: 'pw',
                };
                const res = await request(app)
                    .post(`/api/v1/users/${user.user_id}/password/reset`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
                expect(res.body.errors).to.containSubset([
                    {
                        message: 'Password too short',
                    },
                ]);
            });
            it('should respond with 422 if user and password do not match', async function () {
                const user = await getUser(vwr1);
                const data = {
                    newpwd: 'my modified password',
                    confirmpwd: 'a different password',
                };
                const res = await request(app)
                    .post(`/api/v1/users/${user.user_id}/password/reset`)
                    .auth(token, { type: 'bearer' })
                    .type('json')
                    .send(data);
                expect(res).to.have.status(422);
                expect(res.body.errors).to.containSubset([
                    {
                        message: 'New passwords do not match',
                    },
                ]);
            });
        });
    });

    describe('Manager user', function () {
        let token;

        beforeEach(async function () {
            // Add 2 users and their devices
            await addUserAndDevices({ ...man1, ...man1Auth }, man1Devs);
            await addUserAndDevices({ ...vwr1, ...vwr1Auth }, vwr1Devs);
            // Login as manager user
            const data = {
                username: man1.username,
                password: man1Auth.password,
            };
            const res = await request(app)
                .post('/api/v1/login')
                .type('json')
                .send(data);
            token = res.body.access_token;
        });

        afterEach(async function () {
            // Remove users and their owned devices
            await removeUserAndDevices(man1);
            await removeUserAndDevices(vwr1);
        });

        describe('GET /users', function () {
            it('should respond with 403', async function () {
                const res = await request(app)
                    .get('/api/v1/users')
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(403);
                expect(res.body.message).to.equal('Access denied');
            });
        });

        describe('GET /users/:userId', function () {
            it('should respond with 401 if auth token is missing', async function () {
                const user = await getUser(man1);
                const res = await request(app)
                    .get(`/api/v1/users/${user.user_id}`)
                    .send();
                expect(res).to.have.status(401);
                expect(res.body.message).to.equal('Token required');
            });
            it('should respond with 401 if token type is invalid', async function () {
                const user = await getUser(man1);
                const res = await request(app)
                    .get(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'unknown' })
                    .send();
                expect(res).to.have.status(401);
                expect(res.body.message).to.equal('Token required');
            });
            it('should respond with 401 if token is empty', async function () {
                const user = await getUser(man1);
                const res = await request(app)
                    .get(`/api/v1/users/${user.user_id}`)
                    .auth('', { type: 'bearer' })
                    .send();
                expect(res).to.have.status(401);
                expect(res.body.message).to.equal('Token required');
            });
            it('should respond with 401 if token is invalid', async function () {
                const user = await getUser(man1);
                const res = await request(app)
                    .get(`/api/v1/users/${user.user_id}`)
                    .auth('invalid-token', { type: 'bearer' })
                    .send();
                expect(res).to.have.status(401);
                expect(res.body.message).to.equal('Invalid token');
            });
            it('should respond with 403 if userId from another user', async function () {
                const user = await getUser(vwr1);
                const res = await request(app)
                    .get(`/api/v1/users/${user.user_id}`)
                    .auth(token, { type: 'bearer' })
                    .send();
                expect(res).to.have.status(403);
                expect(res.body.message).to.equal('Access denied');
            });
        });
    });
});
