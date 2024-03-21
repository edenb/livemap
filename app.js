import config from 'config';
import express from 'express';
import favicon from 'serve-favicon';
import flash from 'connect-flash';
import morgan from 'morgan';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from './auth/passport.js';
import routesApi from './routes/api.js';
import routesIndex from './routes/index.js';
import {
    bindStore,
    getStore,
    checkDbUp,
    startMaintenance,
} from './database/db.js';
import { start } from './services/liveserver.js';
import { processLocation } from './services/webhook.js';
import * as mqtt from './services/mqtt.js';
import Logger from './utils/logger.js';

const logger = Logger(import.meta.url);

//
// Application
//

// Express set-up
const app = express();
app.disable('x-powered-by');

// Force HTTPS
if (config.get('server.forceSSL') === 'true') {
    app.use((req, res, next) => {
        if (
            req.headers['x-forwarded-proto'] &&
            req.headers['x-forwarded-proto'] !== 'https'
        ) {
            return res.redirect(301, `https://${req.headers.host}${req.url}`);
        } else {
            next();
        }
    });
}

// Directory and filename of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Static route for JavaScript libraries, css files, etc.
app.use(express.static(__dirname + '/public'));

app.use(favicon(__dirname + '/public/images/favicon.ico'));

// Handle posted positions
app.post('/location/gpx', (req, res) => {
    processLocation(req, res, 'gpx');
});

app.post('/location/locative', (req, res) => {
    processLocation(req, res, 'locative');
});

// View engine set-up
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

// Set up the UI part of our express application
app.use(morgan('combined', { stream: logger.stream })); // log every request to the logger
app.use(express.json()); // get information from html forms
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');

// Sessions stored in 'memory' or 'pg' (database)
bindStore(session, 'memory');
// Don't use sessions for API calls,
// i.e. a token is given in the header (Authorization: <some_token>)
const sessionMiddleware = session({
    name: config.get('sessions.name'),
    store: getStore(),
    secret: config.get('sessions.secret'),
    cookie: { maxAge: config.get('sessions.maxAge'), sameSite: 'strict' },
    resave: false,
    saveUninitialized: true,
    unset: 'keep', // Or destroy?
});

app.use((req, res, next) => {
    return sessionMiddleware(req, res, next);
});

// Set-up flash messages stored in session
app.use(flash());

// Set-up authentication with persistent login sessions
app.use(passport.session());

app.use('/', routesIndex(passport));
app.use('/api/v1', routesApi(passport));

async function allUp() {
    if (await checkDbUp()) {
        const port = config.get('server.port');
        let server = app.listen(port);

        startMaintenance();
        start(server);
        mqtt.start();

        logger.info('Server started on port ' + port);
    } else {
        logger.info('Waiting for the database...');
        setTimeout(allUp, 5000);
    }
}

allUp();
