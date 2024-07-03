import { expect } from 'chai';
import { spy } from 'sinon';
import Logger from '../src/utils/logger.js';
import Validator from '../src/utils/validator.js';

const livemapSchema = {
    title: 'Livemap Schema',
    type: 'object',
    properties: {
        loc_timestamp: {
            description: 'Timestamp of location in ISO 8601 format',
            type: 'string',
            format: 'date-time',
        },
        loc_lat: {
            description: 'Latitude of the location',
            type: 'number',
            minimum: -90,
            maximum: 90,
        },
        loc_lon: {
            description: 'Longitude of the location',
            type: 'number',
            minimum: -180,
            maximum: 180,
        },
        identifier: {
            description: 'The unique identifier of the device',
            type: 'string',
        },
        alias: {
            description: 'Alternative name of the device',
            type: 'string',
        },
        device_id: {
            description: 'Unique ID of the device',
            type: 'number',
        },
        loc_attr: {
            description: 'Additional attributes of the device',
            type: ['null', 'object'],
        },
        loc_type: {
            description: 'Location type of the device',
            type: ['null', 'string'],
        },
        identifier_tag: {
            description: 'The unique identifier of the tag',
            type: ['null', 'string'],
        },
        device_id_tag: {
            description: 'Unique ID of the tag',
            type: ['null', 'number'],
        },
        api_key_tag: {
            description: 'The unique key of the owner of the tag',
            type: ['null', 'string'],
        },
    },
    required: ['loc_timestamp', 'loc_lat', 'loc_lon'],
};

const mqttMessageProcessed = {
    api_key: 'apikey-vwr1',
    identifier: 'vwr1Dev1',
    device_id_tag: null,
    identifier_tag: null,
    api_key_tag: null,
    alias: 'vwr1Dev1',
    loc_timestamp: '2024-05-10T15:14:31.191Z',
    loc_lat: 32.123,
    loc_lon: -110.123,
    loc_type: null,
    loc_attr: undefined,
};

const messageWithoutTimestamp = {
    api_key: 'apikey-vwr1',
    identifier: 'vwr1Dev1',
    device_id_tag: null,
    identifier_tag: null,
    api_key_tag: null,
    alias: 'vwr1Dev1',
    loc_lat: 32.123,
    loc_lon: -110.123,
    loc_type: null,
    loc_attr: undefined,
};

describe.only('Validator', function () {
    const logger = Logger(import.meta.url);
    const loggerSpy = spy(logger, 'error');

    afterEach(function () {
        loggerSpy.resetHistory();
    });

    describe('Load a valid schema from file', function () {
        let validator;

        before(function () {
            validator = new Validator(logger, 'livemap');
        });

        it('should create a validator', async function () {
            expect(validator.schemaValid).to.be.true;
            expect(loggerSpy.notCalled).to.equal(true);
        });
        it('should pass validation on a correct message', async function () {
            const valid = validator.validate(mqttMessageProcessed);
            expect(valid).to.be.true;
            expect(loggerSpy.notCalled).to.equal(true);
        });
        it('should provide a validation error text on a correct message', async function () {
            validator.validate(mqttMessageProcessed);
            expect(validator.errorsText()).to.contain('No errors');
        });
        it('should fail validation on an incorrect message', async function () {
            const pass = validator.validate(messageWithoutTimestamp);
            expect(pass).to.be.false;
            expect(loggerSpy.notCalled).to.equal(true);
        });
        it('should provide a validation error text on an incorrect message', async function () {
            validator.validate(messageWithoutTimestamp);
            expect(validator.errorsText()).to.contain(
                `data must have required property 'loc_timestamp'`,
            );
        });
    });

    describe('Load a valid schema from memory', function () {
        it('should create a validator', async function () {
            const validator = new Validator(logger, 'livemap', livemapSchema);
            expect(validator.schemaValid).to.be.true;
            expect(loggerSpy.notCalled).to.equal(true);
        });
    });

    describe('Load an invalid schema from memory', function () {
        let validator;

        before(function () {
            validator = new Validator(logger, 'livemap', {
                key: 'value',
            });
        });

        it('should log an error', async function () {
            expect(validator.schemaValid).to.be.false;
            expect(loggerSpy.calledOnce).to.equal(true);
            expect(loggerSpy.args[0][0]).to.contain(
                'Unable to create validator.',
            );
        });
        it('should fail validation with an error on a correct message', async function () {
            const valid = validator.validate(mqttMessageProcessed);
            expect(valid).to.be.false;
            expect(loggerSpy.calledOnce).to.equal(true);
            expect(loggerSpy.args[0][0]).to.contain('Unable to validate.');
        });
        it('should provide a validation error text on a correct message', async function () {
            validator.validate(mqttMessageProcessed);
            expect(validator.errorsText()).to.contain('Schema not valid.');
        });
        it('should fail validation with an error on an incorrect message', async function () {
            const pass = validator.validate(messageWithoutTimestamp);
            expect(pass).to.be.false;
            expect(loggerSpy.calledOnce).to.equal(true);
            expect(loggerSpy.args[0][0]).to.contain('Unable to validate.');
        });
        it('should provide a validation error text on an incorrect message', async function () {
            validator.validate(messageWithoutTimestamp);
            expect(validator.errorsText()).to.contain('Schema not valid.');
        });
    });

    describe('Load from a non existing file', function () {
        it('should log an error', async function () {
            const validator = new Validator(logger, 'a-file');
            expect(validator.schemaValid).to.be.false;
            expect(loggerSpy.calledOnce).to.equal(true);
            expect(loggerSpy.args[0][0]).to.contain('Unable to load schema');
        });
    });

    describe('Load a valid schema from memory without a schema name', function () {
        it('should log an error', async function () {
            const validator = new Validator(logger, null, livemapSchema);
            expect(validator.schemaValid).to.be.false;
            expect(loggerSpy.calledOnce).to.equal(true);
            expect(loggerSpy.args[0][0]).to.contain('Schema name is required.');
        });
    });
});
