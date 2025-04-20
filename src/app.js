import config from 'config';
import express from 'express';
import passport from './auth/passport.js';
import { forceHttps } from './middlewares/forcehttps.js';
import { unless } from './middlewares/unless.js';
import routesApi from './routes/api.js';
import routesIndex from './routes/index.js';
import routesWebhook from './routes/webhook.js';
import { processLocation } from './utils/ingester.js';

export default () => {
    const app = express();
    app.disable('x-powered-by');

    // Force HTTPS
    app.use(forceHttps(config.get('server.forceSSL')));

    // Set if server is behind a proxy
    if (config.get('server.proxy')) {
        app.set('trust proxy', 1);
    }

    // View engine set-up
    app.set('views', `${process.cwd()}/views`);
    app.set('view engine', 'pug');

    // Add http routes for index (original UI), API (used by modern UI) and webhooks
    app.use('/api/v1', routesApi(passport));
    app.use('/location', routesWebhook(processLocation));
    app.use(unless(routesIndex(passport), '/location', '/api'));

    return app;
};
