var config = require('config');
var express = require('express');
var flash = require('connect-flash');
var usr = require('../user.js');
var dev = require('../device.js');

var router = express.Router();

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
            res.render('landing', {wclient: config.get('wclient'), flash: req.flash()});
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
        res.render('register', {wclient: config.get('wclient'), flash: req.flash()});
    });

    // Handle Registration POST
    router.post('/signup', passport.authenticate('local', {
        successRedirect: '/home',
        failureRedirect: '/signup',
        failureFlash : true
    }));

    // GET Start Page
    router.get('/main', ensureAuthenticated, function (req, res) {
        res.render('main', {wclient: config.get('wclient'), flash: req.flash(), user: req.user});
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
        var modifyAllowed = 'false';
        if (req.user.role === 'admin' || req.user.role === 'manager') {
            modifyAllowed = 'true';
        }
        res.render('changedetails', {wclient: config.get('wclient'), flash: req.flash(), user: req.user, mod: modifyAllowed});
    });

    // Handle change details POST
    router.post('/changedetails', ensureAuthenticated, function (req, res) {
        if (req.body.operation === 'cancel') {
            res.redirect('/main');
        } else {
            usr.changeDetails(req.user, req.body.fullname, req.body.email, function (err) {
                if (err === null) {
                    req.flash('info', 'Details changed');
                    req.session.save(function (err) {
                        res.redirect('/main');
                    });
                } else {
                    req.flash('error', err);
                    req.session.save(function (err) {
                        res.redirect('/changedetails');
                    });
                }
            });
        }
    });

    // GET Change Password Page
    router.get('/changepassword', ensureAuthenticated, function (req, res) {
        res.render('changepassword', {wclient: config.get('wclient'), flash: req.flash(), user: req.user});
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

    // GET Manage Users Page. Only Admins are allowed to make changes.
    router.get('/manageusers', ensureAuthenticated, function (req, res) {
        if (req.user.role === 'admin') {
            usr.getAllUsers(function (allUsers) {
                res.render('manageusers', {wclient: config.get('wclient'), flash: req.flash(), user: req.user, users: allUsers});
                console.log(JSON.stringify(allUsers));
            });
        } else {
            res.redirect('/main');
        }
    });

    // Handle Manage Users POST
    router.post('/manageusers', ensureAuthenticated, function (req, res) {
        if (req.body.operation === 'cancel') {
            res.redirect('/main');
        } else {
            usr.changeDetails(req.user, req.body.fullname, req.body.email, function (err) {
                if (err === null) {
                    req.flash('info', 'Details changed');
                    req.session.save(function (err) {
                        res.redirect('/main');
                    });
                } else {
                    req.flash('error', err);
                    req.session.save(function (err) {
                        res.redirect('/changedetails');
                    });
                }
            });
        }
    });

    // Handle remove devices POST
    router.post('/removedevices', ensureAuthenticated, function (req, res) {
        // console.log(JSON.stringify(req.body));
        // remove devices here. req.body.checkedIds = array with devices to be deleted
        dev.deleteDevicesById(req.body.checkedIds, function (resrow) {
            res.send('OK');
        });
    });

    return router;
};
