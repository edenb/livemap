import config from 'config';
import flash from 'connect-flash';
import express from 'express';
import morgan from 'morgan';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import favicon from 'serve-favicon';
import passport from './auth/passport.js';
import { forceHttps } from './middlewares/forcehttps.js';
import { sessionMiddleware } from './middlewares/session.js';
import routesApi from './routes/api.js';
import routesIndex from './routes/index.js';
import routesWebhook from './routes/webhook.js';
import { processLocation } from './utils/ingester.js';
import Logger from './utils/logger.js';

export default () => {
    const logger = Logger(import.meta.url);

    const app = express();
    app.disable('x-powered-by');

    // Force HTTPS
    app.use(forceHttps(config.get('server.forceSSL')));

    // Directory and filename of this module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Add http routes for location ingestion
    app.use('/location', routesWebhook(processLocation));

    // Static route for JavaScript libraries, css files, etc.
    app.use(express.static(__dirname + '/../public'));

    // Set favicon
    app.use(favicon(__dirname + '/../public/images/favicon.ico'));

    // View engine set-up
    app.set('views', __dirname + '/../views');
    app.set('view engine', 'pug');

    // Set up the UI part of our express application
    app.use(morgan('combined', { stream: logger.stream })); // log every request to the logger
    app.use(express.json()); // for parsing application/json
    app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    if (config.get('server.proxy')) {
        app.set('trust proxy', 1);
    }

    // Apply session middleware
    const sessionName = config.get('sessions.name');
    const sessionSecret = config.get('sessions.secret');
    const sessionCookie = {
        maxAge: config.get('sessions.maxAge'),
        sameSite: 'strict',
    };
    app.use(sessionMiddleware(sessionName, sessionSecret, sessionCookie));

    // Set-up flash messages stored in session
    app.use(flash());

    // Set-up authentication with persistent login sessions
    app.use(passport.session());

    // Add http routes for index (original UI) and  API (used by modern UI)
    app.use('/', routesIndex(passport));
    app.use('/api/v1', routesApi(passport));

    return app;
};
