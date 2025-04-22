import config from 'config';
import express from 'express';
import morgan from 'morgan';
import { getNewToken, isAuthorized } from '../auth/jwt.js';
import * as users from '../controllers/user.js';
import * as devices from '../controllers/device.js';
import * as positions from '../controllers/position.js';
import * as staticLayers from '../controllers/staticlayer.js';
import * as server from '../controllers/server.js';
import { forceHttps } from '../middlewares/forcehttps.js';
import { catchAll404, httpErrorHandler } from '../middlewares/httperror.js';
import { rateLimiter } from '../middlewares/ratelimiter.js';
import { HttpError } from '../utils/error.js';
import Logger from '../utils/logger.js';

export default (passport) => {
    const logger = Logger(import.meta.url);
    const router = express.Router();

    // Force HTTPS
    router.use(forceHttps(config.get('server.forceSSL')));

    // Apply rate limiting middleware to api routes
    router.use(
        rateLimiter(
            config.get('rateLimiter.window'),
            config.get('rateLimiter.limit'),
        ),
    );

    // Apply logging middleware
    router.use(morgan('combined', { stream: logger.stream }));

    // Apply parser middleware
    router.use(express.json()); // for parsing application/json

    // Enable CORS for API
    router.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header(
            'Access-Control-Allow-Methods',
            'GET,PUT,POST,OPTIONS,DELETE',
        );
        res.header(
            'Access-Control-Allow-Headers',
            'Origin, X-Requested-With, Content-Type, Accept, Authorization',
        );
        // intercept OPTIONS method
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });

    router.get('/', (req, res) => {
        res.status(200).send(`API V1 is up`);
    });

    const requireSignin = function (req, res, next) {
        passport.authenticate('local', (err, user) => {
            if (err || !user) {
                return next(new HttpError(401, 'Login failed'));
            }
            req.user = user;
            return next();
        })(req, res, next);
    };

    router.post('/login', requireSignin, (req, res) => {
        let token = getNewToken(req.user);
        res.status(200).json({
            access_token: token,
            token_type: 'Bearer',
        });
    });

    router.get(
        '/account',
        isAuthorized(['admin', 'manager', 'viewer']),
        users.getAccount,
    );

    router.get('/users', isAuthorized(['admin']), users.getAllUsers);

    router.post('/users', isAuthorized(['admin']), users.addUser);

    router.put('/users/:userId', isAuthorized(['admin']), users.modifyUser);

    router.delete('/users/:userId', isAuthorized(['admin']), users.removeUser);

    router.get(
        '/users/:userId',
        isAuthorized(['admin', 'manager', 'viewer']),
        users.getUserByUserId,
    );

    router.post(
        '/users/:userId/password/change',
        isAuthorized(['admin', 'manager', 'viewer']),
        users.changePassword,
    );

    router.post(
        '/users/:userId/password/reset',
        isAuthorized(['admin']),
        users.resetPassword,
    );

    router.get(
        '/users/:userId/devices',
        isAuthorized(['admin', 'manager', 'viewer']),
        devices.getDevicesByUserId,
    );

    router.post(
        '/users/:userId/devices',
        isAuthorized(['admin', 'manager']),
        devices.addDeviceByUserId,
    );

    router.put(
        '/users/:userId/devices/:deviceId',
        isAuthorized(['admin', 'manager']),
        devices.modifyDeviceByUserId,
    );

    router.delete(
        '/users/:userId/devices/:deviceIds',
        isAuthorized(['admin', 'manager']),
        devices.removeDevicesByUserId,
    );

    router.post(
        '/users/:userId/devices/:deviceIds/shareduser',
        isAuthorized(['admin', 'manager']),
        devices.addSharedUserByUserId,
    );

    router.delete(
        '/users/:userId/devices/:deviceIds/shareduser',
        isAuthorized(['admin', 'manager']),
        devices.removeSharedUserByUserId,
    );

    router.get('/devices', isAuthorized(['admin']), devices.getAllDevices);

    router.get(
        '/positions',
        isAuthorized(['admin', 'manager', 'viewer']),
        positions.getLastPositions,
    );

    router.get(
        '/staticlayers',
        isAuthorized(['admin', 'manager', 'viewer']),
        staticLayers.getStaticLayers,
    );

    router.get(
        '/server/info',
        isAuthorized(['admin', 'manager', 'viewer']),
        server.getInfo,
    );

    router.use(catchAll404);

    // Custom error handling middleware (should be placed at the end)
    router.use(httpErrorHandler(logger));

    return router;
};
