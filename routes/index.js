var config = require('config');
var express = require('express');
var flash = require('connect-flash');
var usr = require('../src/user.js');
var dev = require('../src/device.js');
var mqtt = require('../src/mqtt.js');

var router = express.Router();

function isNumber(num) {
    if(parseInt(num) == num || parseFloat(num) == num) {
        return true;
    }
    else {
        return false;
    }
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
        // Wait for the authentication result is stored in the session, otherwise ensureAuthenticated() may fail
        req.session.save(function (err) {
            res.redirect('/main');
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
    router.get('/changedetails', ensureAuthenticated, function (req, res) {
        if (req.user.role === 'admin') {
            usr.getAllUsers(function (allUsers) {
                res.render('changedetails', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user, users: allUsers});
            });
        } else {
            res.render('changedetails', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user, users: null});
        }
    });

    // Handle change details POST
    router.post('/changedetails', ensureAuthenticated, function (req, res) {
        var modUser = {};
        modUser.user_id = parseInt(req.body.user_id);
        modUser.username = req.body.username;
        modUser.fullname = req.body.fullname;
        modUser.email = req.body.email;
        modUser.role = req.body.role || '';
        modUser.api_key = req.body.api_key;

        switch (req.body.action) {
            case 'cancel':
                res.redirect('/main');
                break;
            case 'submit':
                usr.changeDetails(req.user, modUser, function (err) {
                    if (err === null) {
                        req.flash('info', 'Details changed');
                        req.session.save(function (err) {
                            res.redirect('/changedetails');
                        });
                    } else {
                        req.flash('error', err);
                        req.session.save(function (err) {
                            res.redirect('/changedetails');
                        });
                    }
                });
                break;
            case 'delete':
                usr.deleteUser(req.user, modUser, function (err) {
                     if (err === null) {
                        req.flash('info', 'User deleted');
                        req.session.save(function (err) {
                            res.redirect('/changedetails');
                        });
                    } else {
                        req.flash('error', err);
                        req.session.save(function (err) {
                            res.redirect('/changedetails');
                        });
                    }
                });
                break;
            default:
                res.redirect('/main');
                break;
        }
    });

    // GET Change Devices Page.
    router.get('/changedevices', ensureAuthenticated, function (req, res) {
        dev.getDevicesByUser(req.user.user_id, function (err, userdevices) {
            if (err === null) {
                res.render('changedevices', {wclient: config.get('wclient'), broker: mqtt.getBrokerUrl(), flash: req.flash(), user: req.user, userdevices: userdevices});
            } else {
                req.flash('error', err);
                req.session.save(function (err) {
                    res.redirect('/main');
                });
            }
        });
    });

    // Handle change devices POST
    router.post('/changedevices', ensureAuthenticated, function (req, res) {
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
        switch (req.body.action) {
            case 'cancel':
                res.redirect('/main');
                break;
            case 'submit':
                dev.changeDevice(modDevice, function (err) {
                    if (err === null) {
                        req.flash('info', 'Device changed');
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    } else {
                        req.flash('error', err);
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    }
                });
                break;
            case 'addSharedUser':
                dev.addSharedUser(req.body.shareduser, req.body.checkedIds.split(','), function (err) {
                    if (err === null) {
                        req.flash('info', req.body.checkedIds.split(',').length + ' device(s) shared with user: ' + req.body.shareduser);
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    } else {
                        req.flash('error', err);
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    }
                });
                break;
            case 'delSharedUser':
                dev.deleteSharedUser(req.body.shareduser, req.body.checkedIds.split(','), function (err) {
                    if (err === null) {
                        req.flash('info', req.body.checkedIds.split(',').length + ' device(s) no longer shared with user: ' + req.body.shareduser);
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    } else {
                        req.flash('error', err);
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    }
                });
                break;
            case 'delDevices':
                dev.deleteDevicesById(req.body.checkedIds.split(','), function (err) {
                    if (err === null) {
                        req.flash('info', req.body.checkedIds.split(',').length + ' device(s) removed');
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    } else {
                        req.flash('error', err);
                        req.session.save(function (err) {
                            res.redirect('/changedevices');
                        });
                    }
                });
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
    router.post('/changepassword', ensureAuthenticated, function (req, res) {
        if (req.body.operation === 'cancel') {
            res.redirect('/main');
        } else {
            usr.changePassword(req.user, req.body.oldpassword, req.body.password, req.body.confirm, function (err) {
                if (err === null) {
                    req.flash('info', 'Password changed');
                    req.session.save(function (err) {
                        res.redirect('/main');
                    });
                } else {
                    req.flash('error', err);
                    req.session.save(function (err) {
                        res.redirect('/changepassword');
                    });
                }
            });
        }
    });

    return router;
};
