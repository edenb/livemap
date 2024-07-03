import ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';

export default class Validator {
    constructor(logger, schemaName, schema) {
        this.logger = logger;
        this.schemaName = '';
        this.schemaValid = false;

        try {
            if (!schemaName) {
                throw new Error(`Schema name is required.`);
            }
            if (!schema) {
                schema = this.loadSchemaFromFile(schemaName);
            }
            this.ajvValidate = this.create(schema);
            this.schemaName = schemaName;
            this.schemaValid = true;
        } catch (err) {
            if (this.logger) {
                this.logger.error(err.message);
            }
        }
    }

    create(schema) {
        try {
            this.ajvValidator = new ajv({ allErrors: true, coerceTypes: true });
            const jsonSchemaDraft06 = JSON.parse(
                readFileSync('schemas/json-schema-draft-06.json', 'utf8'),
            );
            this.ajvValidator.addMetaSchema(jsonSchemaDraft06);
            addFormats(this.ajvValidator);
            return this.compileSchema(this.ajvValidator, schema);
        } catch (err) {
            throw new Error(`Unable to create validator. ${err.message}`);
        }
    }

    loadSchemaFromFile(schemaName) {
        try {
            const schema = JSON.parse(
                readFileSync(`./schemas/${schemaName}.json`, 'utf8'),
            );
            return schema;
        } catch (err) {
            throw new Error(
                `Unable to load schema '${schemaName}'. ${err.message}`,
            );
        }
    }

    compileSchema(validator, schema) {
        try {
            return validator.compile(schema);
        } catch (err) {
            throw new Error(`Unable to compile schema. ${err.message}`);
        }
    }

    validate(JSONSource) {
        if (this.schemaValid) {
            return this.ajvValidate(JSONSource);
        } else {
            if (this.logger) {
                this.logger.error(
                    `Schema '${this.schemaName}' not valid. Unable to validate.`,
                );
            }
            return false;
        }
    }

    errorsText() {
        if (this.schemaValid) {
            return this.ajvValidator.errorsText(this.ajvValidate.errors);
        } else {
            return 'Schema not valid.';
        }
    }
}
