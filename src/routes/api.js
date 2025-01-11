import config from 'config';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getNewToken, isAuthorized } from '../auth/jwt.js';
import * as users from '../controllers/user.js';
import * as devices from '../controllers/device.js';
import * as positions from '../controllers/position.js';
import * as staticLayers from '../controllers/staticlayer.js';
import * as server from '../controllers/server.js';

export default (passport) => {
    const router = Router();

    // Apply rate limiting middleware to api routes
    const rateLimiter = rateLimit({
        windowMs: config.get('rateLimiter.window'),
        limit: config.get('rateLimiter.limit'),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
    });
    router.use(rateLimiter);

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

    router.post('/login', passport.authenticate('local'), (req, res) => {
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

    // This middleware always at the end to catch undefined endpoints
    router.use('*', (req, res) => {
        res.status(404).send(`Invalid endpoint`);
    });

    return router;
};
