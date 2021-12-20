'use strict';
const config = require('config');
const express = require('express');
const favicon = require('serve-favicon');
const flash = require('connect-flash');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('./auth/passport');
const db = require('./database/db');
const livesvr = require('./services/liveserver');
const webhook = require('./services/webhook');
const mqtt = require('./services/mqtt');
const logger = require('./utils/logger');

//
// Application
//

// Express set-up
const app = express();

// Force HTTPS
if (config.get('server.forceSSL') === 'true') {
    app.use((req, res, next) => {
        if (
            req.headers['x-forwarded-proto'] &&
            req.headers['x-forwarded-proto'] !== 'https'
        ) {
            res.redirect('https://' + req.headers.host + req.url);
        } else {
            next();
        }
    });
}

// Static route for JavaScript libraries, css files, etc.
app.use(express.static(__dirname + '/public'));

app.use(favicon(__dirname + '/public/images/favicon.ico'));

// Handle posted positions
app.post('/location/gpx', (req, res) => {
    webhook.processLocation(req, res, 'gpx');
});

app.post('/location/locative', (req, res) => {
    webhook.processLocation(req, res, 'locative');
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
db.bindStore(session, 'memory');
// Don't use sessions for API calls,
// i.e. a token is given in the header (Authorization: <some_token>)
const sessionMiddleware = session({
    name: config.get('sessions.name'),
    store: db.getStore(),
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

let indexRoutes = require('./routes/index')(passport);
let apiRoutes = require('./routes/api')(passport);
app.use('/', indexRoutes);
app.use('/api/v1', apiRoutes);

async function allUp() {
    if (await db.checkDbUp()) {
        const port = config.get('server.port');
        let server = app.listen(port);

        db.startMaintenance();
        livesvr.start(server);
        mqtt.start();

        logger.info('Server started on port ' + port);
    } else {
        logger.info('Waiting for the database...');
        setTimeout(allUp, 5000);
    }
}

allUp();
