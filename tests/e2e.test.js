import { expect } from 'chai';
import { agent, request } from './helpers/chai.js';
import { addUserAndDevices, removeUserAndDevices } from './helpers/database.js';
import { adm1Auth, adm1 } from './helpers/fixtures.js';
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
        it('should login as admin', async function () {
            const res = await request(app)
                .post('/api/v1/login')
                .type('json')
                .send(loginAdm1);
            token = res.body.access_token;
            expect(res).have.status(200);
            expect(res.body.token_type).to.equal('Bearer');
            expect(res.body.access_token).to.be.a('string');
        });
    });

    describe('Web service', function () {
        let reqAgent;

        before(async function () {
            // Create a test user without devices
            await addUserAndDevices({ ...adm1Auth, ...adm1 }, []);
            // Create a request agent to retain cookies
            reqAgent = agent(app);
        });
        after(async function () {
            // Remove the test user and its owned devices
            await removeUserAndDevices(adm1);
            // Destroy the request agent
            reqAgent.close();
        });

        it('should GET the landing/login page', async function () {
            const res = await reqAgent.get('/');
            expect(res).to.have.status(200);
            expect(res).not.to.redirect;
        });
        it('should redirect to landing/login page on an unauthorized path', async function () {
            const res = await reqAgent.get('/main');
            expect(res).to.have.status(200);
            expect(res).to.redirect;
        });
        it('should respond with HTTP status 404 on a non existing path', async function () {
            const res = await reqAgent.get('/thispathdoesnotexist');
            expect(res).to.have.status(404);
        });
        it('should login as admin', async function () {
            const res = await reqAgent.post('/login').send(loginAdm1);
            expect(res).to.have.status(200);
            expect(res).to.redirect;
            expect(res).to.have.cookie('connect.sid');
            expect(res.text).to.include('<title>Live Map (test)</title>');
        });
        it('should GET the main page', async function () {
            const res = await reqAgent.get('/main');
            expect(res).to.have.status(200);
            expect(res).not.to.redirect;
            expect(res.text).to.include('<title>Live Map (test)</title>');
        });
    });
});
