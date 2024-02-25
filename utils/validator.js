import ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFile, readFileSync } from 'fs';
import logger from './logger.js';

export default class Validator {
    constructor(schemaName) {
        this._schemaValid = false;
        this._schemaName = schemaName;
        this.ajvValidator = new ajv({ allErrors: true, coerceTypes: true });
        const jsonSchemaDraft06 = JSON.parse(
            readFileSync('schemas/json-schema-draft-06.json', 'utf8'),
        );
        this.ajvValidator.addMetaSchema(jsonSchemaDraft06);
        addFormats(this.ajvValidator);
        this.loadSchema(schemaName);
    }

    loadSchema(schemaName) {
        this._schemaName = schemaName;
        readFile('./schemas/' + schemaName + '.json', (err, data) => {
            if (err) {
                this._schemaValid = false;
                logger.error('Validator <' + this._schemaName + '>: ' + err);
                return;
            }
            try {
                var schema = JSON.parse(data);
            } catch (e) {
                logger.error(
                    'Validator <' +
                        this._schemaName +
                        '>: Unexpected token in schema',
                );
                return;
            }
            this.ajvValidate = this.ajvValidator.compile(schema);
            this._schemaValid = true;
        });
    }

    validate(JSONSource) {
        if (this._schemaValid) {
            return this.ajvValidate(JSONSource);
        } else {
            logger.error(
                'Validator <' +
                    this._schemaName +
                    '>: Schema not valid. Unable to validate',
            );
            return false;
        }
    }

    errorsText() {
        if (this._schemaValid) {
            return this.ajvValidator.errorsText(this.ajvValidate.errors);
        } else {
            return 'Schema not valid';
        }
    }
}
