const config = require('config');
const express = require('express');
require('connect-flash');
const jwt = require('jsonwebtoken');
const usr = require('../src/user.js');
const dev = require('../src/device.js');
const mqtt = require('../src/mqtt.js');

var router = express.Router();

function isNumber(num) {
    if(parseInt(num) == num || parseFloat(num) == num) {
        return true;
    }
    else {
        return false;
    }
}

function getScopes(user) {
    let scopesByRole = new Array();
    scopesByRole['viewer'] = [];
    scopesByRole['manager'] = [];
    scopesByRole['admin'] = ['users', 'devices'];
    if (user.role in scopesByRole) {
        return scopesByRole[user.role];
    } else {
        return [];
    }
}

function getToken(user) {
    let options = {algorithm: 'HS512'};
    let scopes = getScopes(user);
    let token = jwt.sign({user: user.username, scopes: scopes}, 'replacebysecretfromconfig', options);
    return token;
}

function ensureAuthenticated(req, res, next) {
    // if user is authenticated in the session, call the next() to call the next request handler 
    // Passport adds this method to request object. A middleware is allowed to add properties to
    // request and response objects
    if (req.isAuthenticated()) {
        return next();
    } else {
        // if the user is not authenticated then redirect him to the login page
        req.flash('error', 'Login required');
        req.session.save(function (err) {
            res.redirect('/');
        });
    }
}

module.exports = function (passport) {

    // GET login page
    router.get('/', function (req, res) {
        // Save the remote IP address in the session store
        req.session.remoteIP = req.ip;
        req.session.save(function (err) {
            res.render('landing', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash()});
        });
    });

    router.post('/login', passport.authenticate('local', {failureRedirect: '/'}), function (req, res) {
        let token = getToken(req.user);
        // Wait for the authentication result is stored in the session, otherwise ensureAuthenticated() may fail
        req.session.save(function (err) {
            res
                .location('/main')
                .status(302)
                .json({
                    access_token: token,
                    token_type: 'Bearer'
                });
        });
    });

    // GET Registration Page
    router.get('/signup', function (req, res) {
        res.render('register', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash()});
    });

    // Handle Registration POST
    router.post('/signup', passport.authenticate('local', {
        successRedirect: '/home',
        failureRedirect: '/signup',
        failureFlash : true
    }));

    // GET Start Page
    router.get('/main', ensureAuthenticated, function (req, res) {
        res.render('main', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user});
    });

    // Handle Logout
    router.get('/signout', function (req, res) {
        req.session.destroy(function (err) {
            req.logOut();
            res.redirect('/');
        });
    });

    // GET Change Details Page. Only Admins and Managers are allowed to make changes.
    router.get('/changedetails', ensureAuthenticated, async (req, res) => {
        if (req.user.role === 'admin') {
            const queryRes = await usr.getAllUsers();
            let allUsers = queryRes.rows;
            res.render('changedetails', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user, users: allUsers});
        } else {
            res.render('changedetails', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user, users: null});
        }
    });

    // Handle change details POST
    router.post('/changedetails', ensureAuthenticated, async (req, res) => {
        var modUser = {};
        modUser.user_id = parseInt(req.body.user_id);
        modUser.username = req.body.username;
        modUser.fullname = req.body.fullname;
        modUser.email = req.body.email;
        modUser.role = req.body.role || '';
        modUser.api_key = req.body.api_key;

        let queryRes;
        switch (req.body.action) {
            case 'cancel':
                res.redirect('/main');
                break;
            case 'submit':
                queryRes = await usr.changeDetails(req.user, modUser);
                if (queryRes.rowCount === 1) {
                    req.flash('info', 'Details changed');
                    req.session.save(() => {
                        res.redirect('/changedetails');
                    });
                } else {
                    req.flash('error', queryRes.userMessage || 'Unknown error');
                    req.session.save(() => {
                        res.redirect('/changedetails');
                    });
                }
                break;
            case 'delete':
                queryRes = await usr.deleteUser(req.user, modUser);
                if (queryRes.rowCount === 1) {
                    req.flash('info', 'User deleted');
                    req.session.save(() => {
                        res.redirect('/changedetails');
                    });
                } else {
                    req.flash('error', queryRes.userMessage || 'Unknown error');
                    req.session.save(() => {
                        res.redirect('/changedetails');
                    });
                }
                break;
            default:
                res.redirect('/main');
                break;
        }
    });

    // GET Change Devices Page.
    router.get('/changedevices', ensureAuthenticated, async (req, res) => {
        const queryRes = await dev.getDevicesByUser(req.user.user_id);
        let userdevices = queryRes.rows;
        if (typeof queryRes.userMessage === 'undefined') {
            res.render('changedevices', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user, userdevices: userdevices});
        } else {
            req.flash('error', queryRes.userMessage);
            req.session.save(() => {
                res.redirect('/main');
            });
        }
    });

    // Handle change devices POST
    router.post('/changedevices', ensureAuthenticated, async (req, res) => {
        var modDevice = {};
        modDevice.device_id = parseInt(req.body.device_id);
        modDevice.api_key = req.user.api_key;
        modDevice.identifier = req.body.identifier;
        modDevice.alias = req.body.alias;
        if (isNumber(req.body.fixed_loc_lat) && isNumber(req.body.fixed_loc_lon)) {
            modDevice.fixed_loc_lat = req.body.fixed_loc_lat;
            modDevice.fixed_loc_lon = req.body.fixed_loc_lon;
        } else {
            modDevice.fixed_loc_lat = null;
            modDevice.fixed_loc_lon = null;
        }

        let queryRes;
        switch (req.body.action) {
            case 'cancel':
                res.redirect('/main');
                break;
            case 'submit':
                queryRes = await dev.changeDevice(modDevice);
                if (queryRes.rowCount === 1) {
                    req.flash('info', 'Device changed');
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                } else {
                    req.flash('error', queryRes.userMessage || 'Unknown error');
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                }
                break;
            case 'addSharedUser':
                queryRes = await dev.addSharedUser(req.body.shareduser, req.body.checkedIds.split(','));
                if (queryRes.rowCount > 0) {
                    req.flash('info', req.body.checkedIds.split(',').length + ' device(s) shared with user: ' + req.body.shareduser);
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                } else {
                    req.flash('error', queryRes.userMessage || 'Unknown error');
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                }
                break;
            case 'delSharedUser':
                queryRes = await dev.deleteSharedUser(req.body.shareduser, req.body.checkedIds.split(','));
                if (queryRes.rowCount > 0) {
                    req.flash('info', req.body.checkedIds.split(',').length + ' device(s) no longer shared with user: ' + req.body.shareduser);
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                } else {
                    req.flash('error', queryRes.userMessage || 'Unknown error');
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                }
                break;
            case 'delDevices':
                queryRes = await dev.deleteDevicesById(req.body.checkedIds.split(','));
                if (queryRes.rowCount > 0) {
                    req.flash('info', req.body.checkedIds.split(',').length + ' device(s) removed');
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                } else {
                    req.flash('error', queryRes.userMessage || 'Unknown error');
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                }
                break;
            default:
                res.redirect('/main');
                break;
        }
    });

    // GET Change Password Page
    router.get('/changepassword', ensureAuthenticated, function (req, res) {
        res.render('changepassword', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user});
    });

    // Handle change password POST
    router.post('/changepassword', ensureAuthenticated, async (req, res) => {
        if (req.body.operation === 'cancel') {
            res.redirect('/main');
        } else {
            const queryRes = await usr.changePassword(req.user, req.body.oldpassword, req.body.password, req.body.confirm);
            if (queryRes.rowCount === 1) {
                req.flash('info', 'Password changed');
                req.session.save(() => {
                    res.redirect('/main');
                });
            } else {
                req.flash('error', queryRes.userMessage || 'Unknown error');
                req.session.save(() => {
                    res.redirect('/changepassword');
                });
            }
        }
    });

    return router;
};
