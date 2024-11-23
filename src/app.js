import config from 'config';
import flash from 'connect-flash';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import morgan from 'morgan';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import favicon from 'serve-favicon';
import passport from './auth/passport.js';
import { bindStore, getStore } from './database/db.js';
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
    if (config.get('server.forceSSL')) {
        app.use((req, res, next) => {
            if (
                req.headers['x-forwarded-proto'] &&
                req.headers['x-forwarded-proto'] !== 'https'
            ) {
                return res.redirect(
                    301,
                    `https://${req.headers.host}${req.url}`,
                );
            } else {
                next();
            }
        });
    }

    // Directory and filename of this module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Apply the rate limiting middleware to all requests.
    const rateLimiter = rateLimit({
        windowMs: config.get('rateLimiter.window'),
        limit: config.get('rateLimiter.limit'),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
    });
    app.use(rateLimiter);

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
    app.use(express.json()); // get information from html forms
    app.use(express.urlencoded({ extended: true }));
    if (config.get('server.proxy')) {
        app.enable('trust proxy');
    }

    // Store sessions in the database
    bindStore(session);
    // Don't use sessions for API calls,
    // i.e. a token is given in the header (Authorization: <some_token>)
    const sessionMiddleware = session({
        name: config.get('sessions.name'),
        store: getStore(),
        secret: config.get('sessions.secret'),
        cookie: { maxAge: config.get('sessions.maxAge'), sameSite: 'strict' },
        resave: false,
        saveUninitialized: true,
        unset: 'keep',
    });

    app.use((req, res, next) => {
        return sessionMiddleware(req, res, next);
    });

    // Set-up flash messages stored in session
    app.use(flash());

    // Set-up authentication with persistent login sessions
    app.use(passport.session());

    // Add http routes for index (original UI) and  API (used by modern UI)
    app.use('/', routesIndex(passport));
    app.use('/api/v1', routesApi(passport));

    return app;
};
