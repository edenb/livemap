import { expect } from 'chai';
import express from 'express';
import { createRequest, createResponse } from 'node-mocks-http';
import { spy } from 'sinon';
import { forceHttps } from '../src/middlewares/forcehttps.js';
import { rateLimiter } from '../src/middlewares/ratelimiter.js';

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
