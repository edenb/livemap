import { expect } from 'chai';
import express from 'express';
import { createRequest, createResponse } from 'node-mocks-http';
import { spy } from 'sinon';
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
