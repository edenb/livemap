import { expect } from 'chai';
import { parse } from 'node:querystring';
import { restore, spy } from 'sinon';
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
import Logger from '../src/utils/logger.js';

describe.only('Ingester', function () {
    const logger = Logger(import.meta.url);

    before(async function () {
        // Create a test user without devices
        await addUserAndDevices({ ...vwr1Auth, ...vwr1 }, []);
    });

    after(async function () {
        // Remove the test user and its owned devices
        await removeUserAndDevices(vwr1);
    });

    beforeEach(function () {
        spy(logger, 'error');
    });

    afterEach(function () {
        restore();
    });

    describe('GPX', function () {
        it('should process a valid message', async function () {
            const message = parse(gpxMessage);
            const result = await processLocation(logger, 'gpx', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(gpxMessageProcessed);
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should log an error on a message with an unknown api key', async function () {
            const message = {
                ...parse(gpxMessage),
                device_id: 'a-apikey_vwr1Dev1',
            };
            const expectedResult = await processLocation(
                logger,
                'gpx',
                message,
            );
            expect(expectedResult).to.be.null;
            expect(logger.error.args[0][0]).to.equal(
                `Ingester for 'gpx' failed. No API key and/or identity found.`,
            );
        });
        it('should log an error on an invalid message', async function () {
            const message = {
                ...parse(gpxMessage),
                gps_latitude: '1000',
            };
            const expectedResult = await processLocation(
                logger,
                'gpx',
                message,
            );
            expect(expectedResult).to.be.null;
            expect(logger.error.args[0][0]).to.equal(
                `Invalid: data/loc_lat must be <= 90`,
            );
        });
    });

    describe('Locative', function () {
        it('should process a valid device message (trigger = test)', async function () {
            const message = { ...parse(locDevMessage), trigger: 'test' };
            const result = await processLocation(logger, 'locative', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(locDevMessageProcessed);
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should process a valid device message (trigger = enter)', async function () {
            const message = { ...parse(locDevMessage), trigger: 'enter' };
            const result = await processLocation(logger, 'locative', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(locDevMessageProcessed);
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should process a valid device message (trigger = exit)', async function () {
            const message = { ...parse(locDevMessage), trigger: 'exit' };
            const result = await processLocation(logger, 'locative', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql({
                ...locDevMessageProcessed,
                loc_type: 'left',
            });
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should process a valid tag message (trigger = test)', async function () {
            const message = { ...parse(locTagMessage), trigger: 'test' };
            const result = await processLocation(logger, 'locative', message);
            const { device_id, device_id_tag, ...expectedResult } = result;
            expect(expectedResult).to.eql(locTagMessageProcessed);
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should process a valid tag message (trigger = enter)', async function () {
            const message = { ...parse(locTagMessage), trigger: 'enter' };
            const result = await processLocation(logger, 'locative', message);
            const { device_id, device_id_tag, ...expectedResult } = result;
            expect(expectedResult).to.eql(locTagMessageProcessed);
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should process a valid tag message (trigger = exit)', async function () {
            const message = { ...parse(locTagMessage), trigger: 'exit' };
            const result = await processLocation(logger, 'locative', message);
            const { device_id, device_id_tag, ...expectedResult } = result;
            expect(expectedResult).to.eql({
                ...locTagMessageProcessed,
                loc_type: 'left',
            });
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should log an error on a device message with an unknown api key', async function () {
            const message = {
                ...parse(locDevMessage),
                id: 'a-apikey_vwr1Dev1',
            };
            const expectedResult = await processLocation(
                logger,
                'locative',
                message,
            );
            expect(expectedResult).to.be.null;
            expect(logger.error.args[0][0]).to.equal(
                `Ingester for 'locative' failed. No API key and/or identity found.`,
            );
        });
        it('should log an error on a tag message with an unknown api key', async function () {
            const message = {
                ...parse(locTagMessage),
                id: 'a-apikey_vwr1Dev1',
            };
            const expectedResult = await processLocation(
                logger,
                'locative',
                message,
            );
            expect(expectedResult).to.be.null;
            expect(logger.error.args[0][0]).to.equal(
                `Ingester for 'locative' failed. No API key and/or identity found.`,
            );
        });
    });

    describe('MQTT', function () {
        it('should process a valid message', async function () {
            const message = mqttMessage;
            const result = await processLocation(logger, 'mqtt', message);
            const { device_id, ...expectedResult } = result;
            expect(expectedResult).to.eql(mqttMessageProcessed);
            expect(logger.error.notCalled).to.equal(true);
        });
        it('should log an error on a message with an unknown api key', async function () {
            const message = mqttMessage.replace(
                '"apikey":"apikey-vwr1"',
                '"apikey":"a-apikey"',
            );
            const expectedResult = await processLocation(
                logger,
                'mqtt',
                message,
            );
            expect(expectedResult).to.be.null;
            expect(logger.error.args[0][0]).to.equal(
                `Ingester for 'mqtt' failed. No API key and/or identity found.`,
            );
        });
        it('should log an error on an invalid message', async function () {
            const message = mqttMessage.replace(
                '"lat":"32.123"',
                '"lat":"1000"',
            );
            const expectedResult = await processLocation(
                logger,
                'mqtt',
                message,
            );
            expect(expectedResult).to.be.null;
            expect(logger.error.args[0][0]).to.equal(
                `Ingester for 'mqtt' failed. Invalid message: data/lat must be <= 90`,
            );
        });
        it('should log an error on an invalid json', async function () {
            const message = 'a-message';
            const expectedResult = await processLocation(
                logger,
                'mqtt',
                message,
            );
            expect(expectedResult).to.be.null;
            expect(logger.error.args[0][0]).to.equal(
                `Ingester for 'mqtt' failed. Unable to parse payload. Unexpected token 'a', "a-message" is not valid JSON`,
            );
        });
    });
});
