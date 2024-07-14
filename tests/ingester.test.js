import { expect } from 'chai';
import { parse } from 'node:querystring';
import { addUserAndDevices, removeUserAndDevices } from './helpers/database.js';
import {
    gpxMessage,
    gpxMessageProcessed,
    locDevMessage,
    locDevMessageProcessed,
    locTagMessage,
    locTagMessageProcessed,
    mqttMessage,
    mqttMessageProcessed,
    vwr1,
    vwr1Auth,
} from './helpers/fixtures.js';
import { processLocation } from '../src/utils/ingester.js';

describe('Ingester', function () {
    before(async function () {
        // Create a test user without devices
        await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
    });

    after(async function () {
        // Remove the test user and its owned devices
        await removeUserAndDevices(vwr1);
    });

    describe('GPX', function () {
        it('should process a valid message', async function () {
            const message = parse(gpxMessage);
            const result = await processLocation('gpx', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(gpxMessageProcessed);
        });
        it('should fail processing a message with an unknown api key', async function () {
            const message = {
                ...parse(gpxMessage),
                device_id: 'a-apikey_vwr1Dev1',
            };
            const expectedResult = await processLocation('gpx', message);
            expect(expectedResult).to.be.null;
        });
    });

    describe('Locative', function () {
        it('should process a valid device message (trigger = test)', async function () {
            const message = { ...parse(locDevMessage), trigger: 'test' };
            const result = await processLocation('locative', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(locDevMessageProcessed);
        });
        it('should process a valid device message (trigger = enter)', async function () {
            const message = { ...parse(locDevMessage), trigger: 'enter' };
            const result = await processLocation('locative', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(locDevMessageProcessed);
        });
        it('should process a valid device message (trigger = exit)', async function () {
            const message = { ...parse(locDevMessage), trigger: 'exit' };
            const result = await processLocation('locative', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql({
                ...locDevMessageProcessed,
                loc_type: 'left',
            });
        });
        it('should process a valid tag message (trigger = test)', async function () {
            const message = { ...parse(locTagMessage), trigger: 'test' };
            const result = await processLocation('locative', message);
            const { device_id, device_id_tag, ...expectedResult } = result;
            expect(expectedResult).to.eql(locTagMessageProcessed);
        });
        it('should process a valid tag message (trigger = enter)', async function () {
            const message = { ...parse(locTagMessage), trigger: 'enter' };
            const result = await processLocation('locative', message);
            const { device_id, device_id_tag, ...expectedResult } = result;
            expect(expectedResult).to.eql(locTagMessageProcessed);
        });
        it('should process a valid tag message (trigger = exit)', async function () {
            const message = { ...parse(locTagMessage), trigger: 'exit' };
            const result = await processLocation('locative', message);
            const { device_id, device_id_tag, ...expectedResult } = result;
            expect(expectedResult).to.eql({
                ...locTagMessageProcessed,
                loc_type: 'left',
            });
        });
        it('should fail processing a device message with an unknown api key', async function () {
            const message = {
                ...parse(locDevMessage),
                id: 'a-apikey_vwr1Dev1',
            };
            const expectedResult = await processLocation('locative', message);
            expect(expectedResult).to.be.null;
        });
        it('should fail processing a tag message with an unknown api key', async function () {
            const message = {
                ...parse(locTagMessage),
                id: 'a-apikey_vwr1Dev1',
            };
            const expectedResult = await processLocation('locative', message);
            expect(expectedResult).to.be.null;
        });
    });

    describe('MQTT', function () {
        it('should process a valid message', async function () {
            const message = mqttMessage;
            const result = await processLocation('mqtt', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(mqttMessageProcessed);
        });
        it('should fail processing a message with an unknown api key', async function () {
            const message = mqttMessage.replace(
                '"apikey":"apikey-vwr1"',
                '"apikey":"a-apikey"',
            );
            const expectedResult = await processLocation('mqtt', message);
            expect(expectedResult).to.be.null;
        });
        it('should fail processing an invalid message', async function () {
            const message = mqttMessage.replace(
                '"lat":"32.123"',
                '"lat":"1000"',
            );
            const expectedResult = await processLocation('mqtt', message);
            expect(expectedResult).to.be.null;
        });
        it('should fail processing an invalid json', async function () {
            const message = 'a-message';
            const expectedResult = await processLocation('mqtt', message);
            expect(expectedResult).to.be.null;
        });
    });
});
