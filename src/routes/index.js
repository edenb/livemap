import config from 'config';
import flash from 'connect-flash';
import express from 'express';
import morgan from 'morgan';
import favicon from 'serve-favicon';
import { getNewToken } from '../auth/jwt.js';
import { forceHttps } from '../middlewares/forcehttps.js';
import { rateLimiter } from '../middlewares/ratelimiter.js';
import { sessionMiddleware } from '../middlewares/session.js';
import * as usr from '../models/user.js';
import * as dev from '../models/device.js';
import * as pos from '../models/position.js';
import * as sl from '../models/staticlayer.js';
import { getBrokerUrl } from '../services/mqtt.js';
import Logger from '../utils/logger.js';

function isNumber(num) {
    if (parseInt(num) == num || parseFloat(num) == num) {
        return true;
    } else {
        return false;
    }
}

function flashMessage(err) {
    let message = err.message || err.statusText || 'Unknown error';
    if (err.errors && err.errors.length > 0) {
        for (let error of err.errors) {
            message += ` - ${error.message}`;
        }
    }
    return message;
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
        req.session.save(() => {
            res.redirect('/');
        });
    }
}

export default (passport) => {
    const logger = Logger(import.meta.url);
    const router = express.Router();

    // Force HTTPS
    router.use(forceHttps(config.get('server.forceSSL')));

    // Apply rate limiting middleware to index routes
    router.use(
        rateLimiter(
            config.get('rateLimiter.window'),
            config.get('rateLimiter.limit'),
        ),
    );

    // Directory and filename of this module
    const rootDir = process.cwd();

    // Static route for JavaScript libraries, css files, etc.
    router.use(express.static(`${rootDir}/public`));

    // Set favicon
    router.use(favicon(`${rootDir}/public/images/favicon.ico`));

    // Apply logging middleware
    router.use(morgan('combined', { stream: logger.stream }));

    // Apply parser middlewares
    router.use(express.json()); // for parsing application/json
    router.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

    // Apply session middleware
    const sessionName = config.get('sessions.name');
    const sessionSecret = config.get('sessions.secret');
    const sessionCookie = {
        maxAge: config.get('sessions.maxAge'),
        sameSite: 'strict',
        secure: config.get('server.forceSSL'),
    };
    router.use(sessionMiddleware(sessionName, sessionSecret, sessionCookie));
    router.use(passport.session());

    // Set-up flash messages stored in session
    router.use(flash());

    // GET login page
    router.get('/', (req, res) => {
        // Save the remote IP address in the session store
        req.session.remoteIP = req.ip;
        req.session.save(() => {
            res.render('landing', {
                wclient: config.get('wclient'),
                broker: getBrokerUrl(),
                flash: req.flash(),
            });
        });
    });

    router.post(
        '/login',
        passport.authenticate('local', { failureRedirect: '/' }),
        (req, res) => {
            let token = getNewToken(req.user);
            req.session.token = token;
            // Wait for the authentication result is stored in the session, otherwise ensureAuthenticated() may fail
            req.session.save(() => {
                res.location('/main').status(302).json({
                    access_token: token,
                    token_type: 'Bearer',
                });
            });
        },
    );

    // GET Registration Page
    // router.get('/signup', (req, res) => {
    //     res.render('register', {
    //         wclient: config.get('wclient'),
    //         broker: getBrokerUrl(),
    //         flash: req.flash(),
    //     });
    // });

    // Handle Registration POST
    // router.post(
    //     '/signup',
    //     passport.authenticate('local', {
    //         successRedirect: '/home',
    //         failureRedirect: '/signup',
    //         failureFlash: true,
    //     }),
    // );

    // GET Start Page
    router.get('/main', ensureAuthenticated, async (req, res) => {
        const lastPositions = (await pos.getLastPositions(req.user.user_id))
            .rows;
        const staticLayers = await sl.getStaticLayers();
        res.render('main', {
            wclient: config.get('wclient'),
            broker: getBrokerUrl(),
            flash: req.flash(),
            user: req.user,
            lastPositions,
            staticLayers,
        });
    });

    // Handle Logout
    router.get('/signout', (req, res) => {
        req.session.destroy(() => {
            req.logOut(() => {
                res.redirect('/');
            });
        });
    });

    // GET Change Details Page. Only Admins and Managers are allowed to make changes.
    router.get('/changedetails', ensureAuthenticated, async (req, res) => {
        if (req.user.role === 'admin') {
            const { rows: allUsers } = await usr.getAllUsers();
            res.render('changedetails', {
                wclient: config.get('wclient'),
                broker: getBrokerUrl(),
                flash: req.flash(),
                user: req.user,
                users: allUsers,
            });
        } else {
            res.render('changedetails', {
                wclient: config.get('wclient'),
                broker: getBrokerUrl(),
                flash: req.flash(),
                user: req.user,
                users: null,
            });
        }
    });

    // Handle change details POST
    router.post('/changedetails', ensureAuthenticated, async (req, res) => {
        let modUser = {};
        modUser.user_id = parseInt(req.body.user_id);
        modUser.username = req.body.username;
        modUser.fullname = req.body.fullname;
        modUser.email = req.body.email;
        modUser.role = req.body.role || '';
        modUser.api_key = req.body.api_key;
        modUser.password = req.body.password;

        switch (req.body.action) {
            case 'cancel':
                res.redirect('/main');
                break;
            case 'submit':
                try {
                    if (modUser.user_id <= 0) {
                        await usr.addUser(req.user, modUser);
                    } else {
                        await usr.modifyUser(req.user, modUser);
                    }
                    req.flash('info', 'Details changed');
                    req.session.save(() => {
                        res.redirect('/changedetails');
                    });
                } catch (err) {
                    req.flash('error', flashMessage(err));
                    req.session.save(() => {
                        res.redirect('/changedetails');
                    });
                }
                break;
            case 'delete':
                try {
                    const { rowCount } = await usr.deleteUser(
                        req.user,
                        modUser,
                    );
                    if (rowCount === 1) {
                        req.flash('info', 'User deleted');
                        req.session.save(() => {
                            res.redirect('/changedetails');
                        });
                    } else {
                        req.flash('error', 'User not found');
                        req.session.save(() => {
                            res.redirect('/changedetails');
                        });
                    }
                } catch (err) {
                    req.flash('error', flashMessage(err));
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
        const { rows: userdevices } = await dev.getOwnedDevicesByUserId(
            req.user.user_id,
        );
        res.render('changedevices', {
            wclient: config.get('wclient'),
            broker: getBrokerUrl(),
            flash: req.flash(),
            user: req.user,
            userdevices: userdevices,
        });
    });

    // Handle change devices POST
    router.post('/changedevices', ensureAuthenticated, async (req, res) => {
        let modDevice = {};
        modDevice.device_id = Number(req.body.device_id);
        modDevice.api_key = req.user.api_key;
        modDevice.identifier = req.body.identifier;
        modDevice.alias = req.body.alias;
        if (
            isNumber(req.body.fixed_loc_lat) &&
            isNumber(req.body.fixed_loc_lon)
        ) {
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
                try {
                    const { rowCount } = await dev.modifyDevice(modDevice);
                    if (rowCount === 1) {
                        req.flash('info', 'Device changed');
                        req.session.save(() => {
                            res.redirect('/changedevices');
                        });
                    } else {
                        req.flash('error', 'User not found');
                        req.session.save(() => {
                            res.redirect('/changedevices');
                        });
                    }
                } catch (err) {
                    req.flash('error', flashMessage(err));
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                }
                break;
            case 'addSharedUser':
                try {
                    const { rowCount } = await dev.addSharedUser(
                        req.body.shareduser,
                        req.body.checkedIds.split(','),
                    );
                    if (rowCount > 0) {
                        req.flash(
                            'info',
                            req.body.checkedIds.split(',').length +
                                ' device(s) shared with user: ' +
                                req.body.shareduser,
                        );
                        req.session.save(() => {
                            res.redirect('/changedevices');
                        });
                    } else {
                        req.flash('error', 'User not found');
                        req.session.save(() => {
                            res.redirect('/changedevices');
                        });
                    }
                } catch (err) {
                    req.flash('error', flashMessage(err));
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                }
                break;
            case 'delSharedUser':
                try {
                    const { rowCount } = await dev.deleteSharedUser(
                        req.body.shareduser,
                        req.body.checkedIds.split(','),
                    );
                    req.flash(
                        'info',
                        `${rowCount} device(s) no longer shared with user: ${req.body.shareduser}`,
                    );
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                } catch (err) {
                    req.flash('error', flashMessage(err));
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                }
                break;
            case 'delDevices':
                try {
                    const { rowCount } = await dev.deleteDevicesById(
                        req.body.checkedIds.split(','),
                    );
                    req.flash('info', `${rowCount} device(s) removed`);
                    req.session.save(() => {
                        res.redirect('/changedevices');
                    });
                } catch (err) {
                    req.flash('error', flashMessage(err));
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
    router.get('/changepassword', ensureAuthenticated, (req, res) => {
        res.render('changepassword', {
            wclient: config.get('wclient'),
            broker: getBrokerUrl(),
            flash: req.flash(),
            user: req.user,
        });
    });

    // Handle change password POST
    router.post('/changepassword', ensureAuthenticated, async (req, res) => {
        if (req.body.operation === 'cancel') {
            res.redirect('/main');
        } else {
            try {
                await usr.changePassword(
                    req.user.user_id,
                    req.body.password,
                    req.body.confirm,
                    req.body.oldpassword,
                );
                req.flash('info', 'Password changed');
                req.session.save(() => {
                    res.redirect('/main');
                });
            } catch (err) {
                req.flash('error', flashMessage(err));
                req.session.save(() => {
                    res.redirect('/changepassword');
                });
            }
        }
    });

    return router;
};
