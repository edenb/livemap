"use strict";
const config = require('config');
const express = require('express');
const favicon = require('serve-favicon');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('connect-flash');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./db.js');
const usr = require('./user.js');
const livesvr = require('./liveserver.js');
const webhook = require('./webhook.js');
const mqtt = require('./mqtt.js');
const logger = require('./logger.js');

const port = config.get('server.port');

//
// Application
//

// Express set-up
const app = express();

// Force HTTPS
if (config.get('server.forceSSL') === 'true') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
            res.redirect('https://' + req.headers.host + req.url);
        } else {
            next();
        }
    });
}

// Static route for JavaScript libraries, css files, etc.
app.use(express.static(__dirname + '/../public'));

app.use(favicon(__dirname + '/../public/images/favicon.ico'));

// Handle posted positions
app.post('/location/gpx', (req, res) => {
    webhook.processLocation(req, res, 'gpx');
});

app.post('/location/locative', (req, res) => {
    webhook.processLocation(req, res, 'locative');
});

// View engine set-up
app.set('views', __dirname + '/../views');
app.set('view engine', 'pug');

// Set up the UI part of our express application
app.use(morgan('combined', { "stream": logger.stream })); // log every request to the logger
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({extended: true}));
app.enable('trust proxy');

// Sessions stored in 'memory' or 'pg' (database)
db.bindStore(session, 'memory');
// Don't use sessions for API calls,
// i.e. a token is given in the header (Authorization: <some_token>)
const sessionMiddleware = session({
    name: config.get('sessions.name'),
    store: db.getStore(),
    secret: config.get('sessions.secret'),
    cookie: {maxAge: config.get('sessions.maxAge')},
    resave: false,
    saveUninitialized: true,
    unset: 'keep'     // Or destroy?
});

app.use((req, res, next) => {
    if (req.headers.authorization) {
        return next();
    }
    return sessionMiddleware(req, res, next);
});

// Set-up flash messages stored in session
app.use(flash());

// Set-up authentication
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// Passport session set-up
passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser(async (req, id, done) => {
    const queryRes = await usr.getUserByField('user_id', id);
    if (queryRes.rowCount === 0) {
        done(null, {});
    } else {
        done(null, queryRes.rows[0]);
    }
});

passport.use(new LocalStrategy({usernameField: 'username', passwordField: 'password', passReqToCallback: true},
    async (req, username, password, done) => {
        const queryRes = await usr.getUserByField('username', username);
        if (queryRes.rowCount === 0) {
            req.flash('error', 'No such user');
            req.session.save(() => {
                return done(null, false);
            });
        } else {
            const authOK = await usr.checkPassword(queryRes.rows[0], password);
            if (authOK) {
                return done(null, queryRes.rows[0]);
            } else {
                req.flash('error', 'Wrong password');
                req.session.save(() => {
                    return done(null, false);
                });
            }
        }
    })
);

let indexRoutes = require('../routes/index')(passport);
let apiRoutes = require('../routes/api')();
app.use('/', indexRoutes);
app.use('/api/v1', apiRoutes);

function allUp() {
    if (db.checkDbUp()) {
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
