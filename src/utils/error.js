export class ValidationError extends Error {
    constructor(errors) {
        super('Validation failed');
        this.name = 'ValidationError';
        this.errors = errors;
        Error.captureStackTrace(this, ValidationError);
    }
}

export class HttpError extends Error {
    constructor(statusCode) {
        super();
        this.name = 'HttpError';
        this.statusCode = statusCode;
        Error.captureStackTrace(this, HttpError);
    }
}
