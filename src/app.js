"use strict";
var config = require('config');
var express = require('express');
var favicon = require('serve-favicon');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var session = require('express-session');
var db = require('./db.js');
var usr = require('./user.js');
var livesvr = require('./liveserver.js');
var webhook = require('./webhook.js');
var mqtt = require('./mqtt.js');
var logger = require('./logger.js');

var port = config.get('server.port');

//
// Application
//

// Express set-up
var app = express();

// Force HTTPS
if (config.get('server.forceSSL') === 'true') {
    app.use(function (req, res, next) {
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
app.post('/location/gpx', function (req, res) {
    webhook.processLocation(req, res, 'gpx');
});

app.post('/location/geofancy', function (req, res) {
    webhook.processLocation(req, res, 'geofancy');
});

// View engine set-up
app.set('views', __dirname + '/../views');
app.set('view engine', 'pug');

// Set up the UI part of our express application
app.use(morgan('combined', { "stream": logger.stream })); // log every request to the logger
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({extended: true}));
app.enable('trust proxy');

// Sessions stored in database
db.bindStore(session);
app.use(session({
    name: config.get('sessions.name'),
    store: db.getStore(),
    secret: config.get('sessions.secret'),
    cookie: {maxAge: config.get('sessions.maxAge')},
    resave: false,
    saveUninitialized: true,
    unset: 'keep'     // Or destroy?
}));

// Set-up flash messages stored in session
app.use(flash());

// Set-up authentication
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// Passport session set-up
passport.serializeUser(function (user, done) {
    done(null, user.user_id);
});

passport.deserializeUser(function (req, id, done) {
    usr.findUser('id', id, function (err, user) {
        done(null, user);
    });
});

passport.use(new LocalStrategy({usernameField: 'username', passwordField: 'password', passReqToCallback: true},
    function (req, username, password, done) {
        usr.findUser('username', username, function (err, user) {
            if (user === null) {
                req.flash('error', 'No such user');
                req.session.save(function (err) {
                    return done(null, false);
                });
            } else {
                usr.checkPassword(user, password, function (authOK) {
                    if (authOK) {
                        return done(null, user);
                    } else {
                        req.flash('error', 'Wrong password');
                        req.session.save(function (err) {
                            return done(null, false);
                        });
                    }
                });
            }
        });
    })
);

var routes = require('../routes/index')(passport);
app.use('/', routes);

function allUp() {
    if (db.checkDbUp()) {
        var server = app.listen(port);

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

