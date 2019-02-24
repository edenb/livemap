"use strict";
var ajv = require('ajv');
var fs = require('fs');

class Validator {
    constructor(schemaName) {
        this._schemaValid = false;
        this._schemaName = schemaName;
        this.ajvValidator = ajv({schemaId: 'auto', allErrors: true, coerceTypes: true});
        this.ajvValidator.addMetaSchema(require('./schemas/json-schema-draft-06.json'));
        this.loadSchema(schemaName);
    }

    loadSchema(schemaName) {
        // Save the scope for later use.
        let self = this;
        this._schemaName = schemaName;
        fs.readFile('./schemas/' + schemaName + '.json', function (err,data) {
            if (err) {
                self._schemaValid = false;
                console.error('Validator <' + self._schemaName + '>: ' + err);
                return;
            }
            try {
                var schema = JSON.parse(data);
            } catch (e) {
                console.error('Validator <' + self._schemaName + '>: Unexpected token in schema');
                return;
            }
            self.ajvValidate = self.ajvValidator.compile(schema);
            self._schemaValid = true;
        });
    }
  
    validate(JSONSource) {
        if (this._schemaValid) {
            return this.ajvValidate(JSONSource);
        } else {
            console.error('Validator <' + this._schemaName + '>: Schema not valid. Unable to validate');
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

module.exports = Validator;
