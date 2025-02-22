import { STATUS_CODES } from 'node:http';
import pg from 'pg';
import { HttpError, ValidationError } from '../utils/error.js';
import Logger from '../utils/logger.js';

const logger = Logger(import.meta.url);

// Based on https://docs.postgrest.org/en/latest/references/errors.html
const databaseErrorStatusList = [
    { databaseError: '08', statusCode: 503 },
    { databaseError: '09', statusCode: 500 },
    { databaseError: '0L', statusCode: 403 },
    { databaseError: '0P', statusCode: 403 },
    { databaseError: '23503', statusCode: 409 },
    { databaseError: '23505', statusCode: 409 },
    { databaseError: '25006', statusCode: 405 },
    { databaseError: '25', statusCode: 500 },
    { databaseError: '28', statusCode: 403 },
    { databaseError: '2D', statusCode: 500 },
    { databaseError: '38', statusCode: 500 },
    { databaseError: '39', statusCode: 500 },
    { databaseError: '3B', statusCode: 500 },
    { databaseError: '40', statusCode: 500 },
    { databaseError: '53400', statusCode: 500 },
    { databaseError: '53', statusCode: 503 },
    { databaseError: '54', statusCode: 500 },
    { databaseError: '55', statusCode: 500 },
    { databaseError: '57', statusCode: 500 },
    { databaseError: '58', statusCode: 500 },
    { databaseError: 'F0', statusCode: 500 },
    { databaseError: 'HV', statusCode: 500 },
    { databaseError: 'P0001', statusCode: 400 },
    { databaseError: 'P0', statusCode: 500 },
    { databaseError: 'XX', statusCode: 500 },
    { databaseError: '42883', statusCode: 404 },
    { databaseError: '42P01', statusCode: 404 },
    { databaseError: '42P17', statusCode: 500 },
    { databaseError: '42501', statusCode: 403 },
];

function statusCodeFromDatabaseError(err) {
    const databaseErrorStatus = databaseErrorStatusList.find((e) =>
        err.code.startsWith(e.databaseError),
    );
    if (databaseErrorStatus) {
        return databaseErrorStatus.statusCode;
    } else {
        return 500;
    }
}

export function httpErrorHandler(err, _req, res, _next) {
    let errors = [];
    let errStatusCode;
    let message = '';

    if (err instanceof pg.DatabaseError) {
        errStatusCode = statusCodeFromDatabaseError(err);
        // Only provide details on client errors (4XX)
        if (errStatusCode >= 400 && errStatusCode < 500) {
            message = err.message;
        }
    } else if (err instanceof HttpError) {
        errStatusCode = err.statusCode;
        message = err.message;
    } else if (err instanceof ValidationError) {
        errStatusCode = 422;
        message = err.message;
        errors = err.errors;
    } else {
        errStatusCode = 500;
        logger.error(err.message);
    }

    res.status(errStatusCode).json({
        success: false,
        statusCode: errStatusCode,
        statusText: STATUS_CODES[errStatusCode],
        message: message,
        errors: errors,
        stack: process.env.NODE_ENV === 'development' ? err.stack : {},
    });
}
