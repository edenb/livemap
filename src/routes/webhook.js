import config from 'config';
import { Router, urlencoded } from 'express';
import { rateLimiter } from '../middlewares/ratelimiter.js';
import { HttpError } from '../utils/error.js';
import Logger from '../utils/logger.js';

export default (onLocation) => {
    const logger = Logger(import.meta.url);
    const router = Router();

    // Apply rate limiting middleware to webhook routes
    router.use(
        rateLimiter(
            config.get('rateLimiter.window'),
            config.get('rateLimiter.limit'),
        ),
    );

    // Handle url encoded payloads
    router.use(urlencoded({ extended: false }));

    router.post('/gpx', async (req, res) => {
        let payload;
        // Use the payload from the query string or the body.
        // Respond with errorcode 422 if neither are provided or
        // processing of the data fails.
        if (Object.keys(req.query).length > 0) {
            payload = req.query;
        } else if (Object.keys(req.body).length > 0) {
            payload = req.body;
        } else {
            throw new HttpError(422);
        }

        if (payload) {
            await onLocation(logger, 'gpx', payload);
            res.sendStatus(200);
        }
    });

    router.post('/locative', async (req, res) => {
        let payload;
        // Use payload from query string or body. Query string is preferred.
        // Respond with errorcode 422 if neither are provided.
        if (Object.keys(req.query).length > 0) {
            payload = req.query;
        } else if (Object.keys(req.body).length > 0) {
            payload = req.body;
        } else {
            throw new HttpError(422);
        }

        if (payload) {
            await onLocation(logger, 'locative', payload);
            res.sendStatus(200);
        }
    });

    return router;
};
