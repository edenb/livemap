import { expect } from 'chai';
import express from 'express';
import { createRequest, createResponse } from 'node-mocks-http';
import pg from 'pg';
import { spy } from 'sinon';
import { catchAll404, httpErrorHandler } from '../src/middlewares/error.js';
import { forceHttps } from '../src/middlewares/forcehttps.js';
import { rateLimiter } from '../src/middlewares/ratelimiter.js';
import { HttpError, ValidationError } from '../src/utils/error.js';

describe('Middlewares', function () {
    let req, res, next;

    beforeEach(function () {
        req = createRequest({ method: 'GET', url: '/' });
        res = createResponse();
        next = spy();
    });

    afterEach(function () {
        next.resetHistory();
    });

    describe('HTTP error handler', function () {
        describe('when DatabaseError', function () {
            let err = new pg.DatabaseError('Test message', 0, 'error');
            it('should respond with 409 on database error 23503', async function () {
                err.code = '23503';
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res.statusCode).to.equal(409);
                expect(res._getJSONData().statusCode).to.equal(409);
            });
            it('should respond with message details on database error 23503', async function () {
                err.code = '23503';
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res._getJSONData().message).to.equal('Test message');
            });
            it('should respond with 503 on database error 08', async function () {
                err.code = '08';
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res.statusCode).to.equal(503);
                expect(res._getJSONData().statusCode).to.equal(503);
            });
            it('should respond without message details on database error 08', async function () {
                err.code = '08';
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res._getJSONData().message).to.equal('');
            });
            it('should respond with 500 on unknown database error', async function () {
                err.code = 'AAAAA';
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res.statusCode).to.equal(500);
                expect(res._getJSONData().statusCode).to.equal(500);
            });
            it('should respond without message details on unknown database error', async function () {
                err.code = 'AAAAA';
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res._getJSONData().message).to.equal('');
            });
        });

        describe('when HttpError', function () {
            let err = new HttpError(404, 'User not found');
            it('should respond with 404', async function () {
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res.statusCode).to.equal(404);
                expect(res._getJSONData().statusCode).to.equal(404);
            });
            it('should respond with message details', async function () {
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res._getJSONData().message).to.equal('User not found');
            });
        });

        describe('when ValidationError', function () {
            const errors = [
                {
                    code: 'testCode',
                    field: 'testField',
                    message: 'Test message',
                },
            ];
            let err = new ValidationError(errors);
            it('should respond with 422', async function () {
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res.statusCode).to.equal(422);
                expect(res._getJSONData().statusCode).to.equal(422);
            });
            it('should respond with message details', async function () {
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res._getJSONData().message).to.equal(
                    'Validation failed',
                );
            });
            it('should respond with an error list', async function () {
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res._getJSONData().errors).to.be.an('array');
                expect(res._getJSONData().errors).to.deep.include.members(
                    errors,
                );
            });
        });

        describe('when an unknown error', function () {
            let err = new Error();
            it('should respond with 500', async function () {
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res.statusCode).to.equal(500);
                expect(res._getJSONData().statusCode).to.equal(500);
            });
            it('should respond without message details', async function () {
                const httpErrorHandlerTest = httpErrorHandler;
                httpErrorHandlerTest(err, req, res, next);
                expect(res._getJSONData().message).to.equal('');
            });
        });
    });

    describe('HTTP catch all', function () {
        it('should respond with 404 and message details', async function () {
            const catchAll404Test = catchAll404;
            catchAll404Test(req, res, next);
            expect(next.calledOnce).to.equal(true);
            expect(next.args[0][0]).to.be.an('error');
            expect(next.args[0][0].statusCode).to.equal(404);
            expect(next.args[0][0].name).to.equal('HttpError');
            expect(next.args[0][0].message).to.equal('Invalid endpoint');
        });
    });

    describe('Force HTTPS', function () {
        describe('when disabled', function () {
            const enabled = false;
            describe('and without proxy', function () {
                it('should not redirect on HTTP', function () {
                    req.secure = false;
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.calledOnce).to.equal(true);
                    expect(res.statusCode).to.equal(200);
                });
                it('should not redirect on HTTPS', function () {
                    req.secure = true;
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.calledOnce).to.equal(true);
                    expect(res.statusCode).to.equal(200);
                });
            });
            describe('and behind proxy', function () {
                it('should not redirect on HTTP', function () {
                    req.secure = false;
                    req.headers = { 'x-forwarded-proto': 'http' };
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.calledOnce).to.equal(true);
                    expect(res.statusCode).to.equal(200);
                });
                it('should not redirect on HTTPS', function () {
                    req.secure = true;
                    req.headers = { 'x-forwarded-proto': 'https' };
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.calledOnce).to.equal(true);
                    expect(res.statusCode).to.equal(200);
                });
            });
        });

        describe('when enabled', function () {
            const enabled = true;
            describe('and without proxy', function () {
                it('should redirect on HTTP', function () {
                    req.secure = false;
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.called).to.equal(false);
                    expect(res.statusCode).to.equal(301);
                });
                it('should not redirect on HTTPS', function () {
                    req.secure = true;
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.calledOnce).to.equal(true);
                    expect(res.statusCode).to.equal(200);
                });
            });
            describe('and behind proxy', function () {
                it('should redirect on HTTP', function () {
                    req.secure = false;
                    req.headers = { 'x-forwarded-proto': 'http' };
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.called).to.equal(false);
                    expect(res.statusCode).to.equal(301);
                });
                it('should not redirect on HTTPS', function () {
                    req.secure = true;
                    req.headers = { 'x-forwarded-proto': 'https' };
                    const forceHttpsTest = forceHttps(enabled);
                    forceHttpsTest(req, res, next);
                    expect(next.calledOnce).to.equal(true);
                    expect(res.statusCode).to.equal(200);
                });
            });
        });
    });

    describe('Rate limiter', function () {
        it('should respond with 429 when request rate limit exceeded', async function () {
            // Rate limiter expects req.app to be present
            req.app = express();
            const rateLimiterTest = rateLimiter(1000, 10);
            for (let reqCount = 0; reqCount < 10; reqCount++) {
                await rateLimiterTest(req, res, next);
                expect(res.statusCode).to.equal(200);
            }
            expect(next.callCount).to.equal(10);
            await rateLimiterTest(req, res, next);
            expect(next.callCount).to.equal(10);
            expect(res.statusCode).to.equal(429);
            expect(res._getData()).to.equal(
                'Too many requests, please try again later.',
            );
        });
    });
});
