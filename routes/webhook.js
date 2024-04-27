import { Router, urlencoded } from 'express';
import { processLocation } from '../utils/ingester.js';

export default () => {
    const router = Router();

    router.post('/gpx', urlencoded({ extended: false }), async (req, res) => {
        let payload;
        // Use payload from query string or body. Query string is preferred.
        // Respond with errorcode 422 if neither are provided.
        if (Object.keys(req.query).length > 0) {
            payload = req.query;
        } else if (Object.keys(req.body).length > 0) {
            payload = req.body;
        } else {
            res.sendStatus(422);
        }

        if (payload) {
            try {
                await processLocation('gpx', payload);
                res.sendStatus(200);
            } catch {
                res.sendStatus(422);
            }
        }
    });

    router.post(
        '/locative',
        urlencoded({ extended: false }),
        async (req, res) => {
            let payload;
            // Use payload from query string or body. Query string is preferred.
            // Respond with errorcode 422 if neither are provided.
            if (Object.keys(req.query).length > 0) {
                payload = req.query;
            } else if (Object.keys(req.body).length > 0) {
                payload = req.body;
            } else {
                res.sendStatus(422);
            }

            if (payload) {
                try {
                    await processLocation('locative', payload);
                    res.sendStatus(200);
                } catch {
                    res.sendStatus(422);
                }
            }
        },
    );

    return router;
};
