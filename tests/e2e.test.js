import { expect } from 'chai';
import { agent, request, subset } from './helpers/chai.js';
import {
    addUserAndDevices,
    getDevices,
    getUser,
    removeUserAndDevices,
} from './helpers/database.js';
import {
    adm1Auth,
    adm1,
    adm1Devs,
    gpxMessage,
    vwr1Auth,
    vwr1,
    vwr2Auth,
    vwr2,
} from './helpers/fixtures.js';
import { createMqttServer, destroyMqttServer } from './helpers/mqtt.js';
import App from '../src/app.js';
import { allDown, allUp } from '../src/server.js';
import * as mqttService from '../src/services/mqtt.js';

describe('e2e', function () {
    const app = App();
    let mqttServer;
    const loginAdm1 = {
        username: adm1.username,
        password: adm1Auth.password,
    };
    const loginVwr1 = {
        username: vwr1.username,
        password: vwr1Auth.password,
    };

    before(async function () {
        // Create a local MQTT server
        mqttServer = await createMqttServer(mqttService.getBrokerUrl().port);
        // Start the livemap application
        await allUp(app);
    });

    after(async function () {
        // Stop the livemap application
        await allDown();
        // Destroy the local MQTT server
        await destroyMqttServer(mqttServer);
    });

    describe('REST service', function () {
        let token;

        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...adm1Auth, ...adm1 }, []);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(adm1);
        });

        describe('Anonymous user', function () {
            it('should respond with 401 on login with a wrong password', async function () {
                const res = await request(app)
                    .post('/api/v1/login')
                    .type('json')
                    .send({
                        username: adm1.username,
                        password: 'wrongpassword',
                    });
                expect(res).to.have.status(401);
            });
            it('should respond with 401 on login with a wrong username', async function () {
                const res = await request(app)
                    .post('/api/v1/login')
                    .type('json')
                    .send({
                        username: 'wrongusername',
                        password: adm1Auth.password,
                    });
                expect(res).to.have.status(401);
            });
        });

        describe('Admin user', function () {
            it('should login as admin', async function () {
                const res = await request(app)
                    .post('/api/v1/login')
                    .type('json')
                    .send(loginAdm1);
                token = res.body.access_token;
                expect(res).to.have.status(200);
                expect(res.body.token_type).to.equal('Bearer');
                expect(res.body.access_token).to.be.a('string');
            });
        });
    });

    describe('Web service', function () {
        let reqAgent;

        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...adm1Auth, ...adm1 }, [adm1Devs[0]]);
            await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
            // Create a request agent to retain cookies
            reqAgent = agent(app);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(adm1);
            await removeUserAndDevices(vwr1);
            await removeUserAndDevices(vwr2);
            // Destroy the request agent
            reqAgent.close();
        });

        describe('Anonymous user', function () {
            it('should GET the landing/login page', async function () {
                const res = await reqAgent.get('/');
                expect(res).to.have.status(200);
                expect(res).not.to.redirect;
            });
            it('should redirect to landing/login page on an unauthorized path', async function () {
                const res = await reqAgent.get('/main');
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/$/);
            });
            it('should respond with HTTP status 404 on a non existing path', async function () {
                const res = await reqAgent.get('/a-path');
                expect(res).to.have.status(404);
            });
            it('should respond with an error on login with a wrong password', async function () {
                const res = await reqAgent.post('/login').send({
                    username: adm1.username,
                    password: 'wrongpassword',
                });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/$/);
                expect(res.text).to.include('Wrong password');
            });
            it('should respond with an error on login with a wrong username', async function () {
                const res = await reqAgent.post('/login').send({
                    username: 'wrongusername',
                    password: adm1Auth.password,
                });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/$/);
                expect(res.text).to.include('No such user');
            });
        });

        describe('Admin user', function () {
            it('should login as admin', async function () {
                const res = await reqAgent.post('/login').send(loginAdm1);
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
                expect(res).to.have.cookie('connect.sid');
                expect(res.text).to.include('<title>Livemap name</title>');
            });
            it('should GET the main page', async function () {
                const res = await reqAgent.get('/main');
                expect(res).to.have.status(200);
                expect(res).not.to.redirect;
                expect(res.text).to.include('<title>Livemap name</title>');
            });
            it('should GET the change details page', async function () {
                const res = await reqAgent.get('/changedetails');
                expect(res).to.have.status(200);
                expect(res).not.to.redirect;
                expect(res.text).to.include('"username":"adm1"');
            });
            it('should GET the change devices page', async function () {
                const res = await reqAgent.get('/changedevices');
                expect(res).to.have.status(200);
                expect(res).not.to.redirect;
                expect(res.text).to.include('#table-userdevices');
            });
            it('should GET the change password page', async function () {
                const res = await reqAgent.get('/changepassword');
                expect(res).to.have.status(200);
                expect(res).not.to.redirect;
                expect(res.text).to.include('<legend>Change password</legend>');
            });
            it('should GET the signup page', async function () {
                const res = await reqAgent.get('/#register-modal');
                expect(res).to.have.status(200);
                expect(res).not.to.redirect;
                expect(res.text).to.include(
                    'Registration is not possible at this time.',
                );
            });
            it('should POST a modify user action', async function () {
                const data = {
                    ...(await getUser(adm1)),
                    email: 'admin1modified@example.com',
                    fullname: 'Admin 1 modified',
                };
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, action: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedetails$/);
                const modifiedUser = await getUser(adm1);
                expect(modifiedUser).to.include(data);
            });
            it('should POST a new user action', async function () {
                const data = {
                    ...vwr2Auth,
                    ...vwr2,
                    user_id: -1,
                };
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, action: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedetails$/);
                const newUser = await getUser(vwr2);
                expect(newUser).to.include(vwr2);
            });
            it('should POST a new user without role action', async function () {
                const data = {
                    ...vwr2Auth,
                    ...vwr2,
                    user_id: -1,
                    role: '',
                };
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, action: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedetails$/);
                expect(res.text).to.include('Validation failed');
            });
            it('should POST a delete user action', async function () {
                const data = await getUser(vwr2);
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, action: 'delete' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedetails$/);
                const deletedUser = await getUser(vwr2);
                expect(deletedUser).to.be.null;
            });
            it('should POST a delete unknown user action', async function () {
                const data = await getUser(vwr2);
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, user_id: 2147483647, action: 'delete' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedetails$/);
                expect(res.text).to.include('User not found');
            });
            it('should POST a delete invalid user action', async function () {
                const data = await getUser(vwr2);
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, user_id: 0, action: 'delete' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedetails$/);
                expect(res.text).to.include('Validation failed');
            });
            it('should POST a cancel user action', async function () {
                const data = await getUser(vwr2);
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, action: 'cancel' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
            });
            it('should POST an invalid user action', async function () {
                const data = await getUser(vwr2);
                const res = await reqAgent
                    .post('/changedetails')
                    .send({ ...data, action: 'a-action' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
            });
            it('should POST a change password action', async function () {
                const data = {
                    oldpassword: adm1Auth.password,
                    password: 'my modified password',
                    confirm: 'my modified password',
                };
                const res = await reqAgent
                    .post('/changepassword')
                    .send({ ...data, operation: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
                expect(res.text).to.include('Password changed');
            });
            it('should POST a wrong change password action', async function () {
                const data = {
                    oldpassword: 'my modified password',
                    password: 'my modified password 1',
                    confirm: 'my modified password 2',
                };
                const res = await reqAgent
                    .post('/changepassword')
                    .send({ ...data, operation: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changepassword$/);
                expect(res.text).to.include('New passwords do not match');
            });
            it('should POST a cancel change password action', async function () {
                const data = {
                    oldpassword: 'my modified password',
                    password: 'my modified password',
                    confirm: 'my modified password',
                };
                const res = await reqAgent
                    .post('/changepassword')
                    .send({ ...data, operation: 'cancel' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
            });
            it('should POST a modify device action', async function () {
                const data = {
                    ...(await getDevices(adm1))[0],
                    fixed_loc_lat: 40.7,
                    fixed_loc_lon: -73.9,
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('Device changed');
                const devices = subset(
                    await getDevices(adm1),
                    Object.keys(adm1Devs[0]),
                );
                expect(devices).to.deep.include(adm1Devs[0]);
            });
            it('should POST a new device action', async function () {
                const data = {
                    ...adm1Devs[1],
                    device_id: -1,
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('Device changed');
                const devices = subset(
                    await getDevices(adm1),
                    Object.keys(adm1Devs[1]),
                );
                expect(devices).to.deep.include(adm1Devs[1]);
            });
            it('should POST an invalid new device action', async function () {
                const data = {
                    device_id: -1,
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'submit' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('Unable to add device');
            });
            it('should POST an add shared user action', async function () {
                const data = {
                    shareduser: vwr1.username,
                    checkedIds: (
                        await getDevices(adm1)
                    )[0].device_id.toString(),
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'addSharedUser' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('device(s) shared with user:');
            });
            it('should POST an add shared user action with an invalid user', async function () {
                const data = {
                    shareduser: 'a-user',
                    checkedIds: (
                        await getDevices(adm1)
                    )[0].device_id.toString(),
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'addSharedUser' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('No shared users were added');
            });
            it('should POST a delete shared user action', async function () {
                const data = {
                    shareduser: vwr1.username,
                    checkedIds: (
                        await getDevices(adm1)
                    )[0].device_id.toString(),
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'delSharedUser' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include(
                    'device(s) no longer shared with user:',
                );
            });
            it('should POST a delete shared user action with an invalid user', async function () {
                const data = {
                    shareduser: 'a-user',
                    checkedIds: (
                        await getDevices(adm1)
                    )[0].device_id.toString(),
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'delSharedUser' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('No shared users were deleted');
            });
            it('should POST a delete devices action', async function () {
                const data = {
                    checkedIds: (
                        await getDevices(adm1)
                    )[0].device_id.toString(),
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'delDevices' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('device(s) removed');
            });
            it('should POST a delete devices action with an non existing device', async function () {
                const data = {
                    checkedIds: '-1',
                };
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'delDevices' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/changedevices$/);
                expect(res.text).to.include('No devices were deleted');
            });
            it('should POST a cancel device action', async function () {
                const data = (await getDevices(adm1))[0];
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'cancel' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
            });
            it('should POST an invalid device action', async function () {
                const data = (await getDevices(adm1))[0];
                const res = await reqAgent
                    .post('/changedevices')
                    .send({ ...data, action: 'a-action' });
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
            });
            it('should signout', async function () {
                const res = await reqAgent.get('/signout');
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/$/);
            });
        });

        describe('Viewer user', function () {
            it('should login as viewer', async function () {
                const res = await reqAgent.post('/login').send(loginVwr1);
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/main$/);
                expect(res).to.have.cookie('connect.sid');
                expect(res.text).to.include('<title>Livemap name</title>');
            });
            it('should GET the change details page', async function () {
                const res = await reqAgent.get('/changedetails');
                expect(res).to.have.status(200);
                expect(res).not.to.redirect;
                expect(res.text).to.include('usersData={"users":null}');
            });
        });
    });

    describe('Webhook', function () {
        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(vwr1);
        });

        describe('/post 120 subsequent requests', function () {
            it('should respond with HTTP status 429', async function () {
                this.timeout(10000);
                let res;
                for (let i = 0; i < 120; i++) {
                    res = await request(app)
                        .post('/location/gpx')
                        .query(gpxMessage)
                        .send('');
                }
                expect(res).to.have.status(429);
            });
        });
    });
});
