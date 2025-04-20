import config from 'config';
import jsonwebtoken from 'jsonwebtoken';
import { HttpError } from '../utils/error.js';

//
// Exported modules
//

export function getNewToken(user) {
    let options = { algorithm: config.get('auth.tokenAlgorithm') };
    let token = jsonwebtoken.sign(
        { userId: user.user_id, role: user.role },
        config.get('auth.tokenSecret'),
        options,
    );
    return token;
}

export function getTokenPayload(token) {
    let payload = null;
    let options = { algorithm: config.get('auth.tokenAlgorithm') };
    try {
        payload = jsonwebtoken.verify(
            token,
            config.get('auth.tokenSecret'),
            options,
        );
    } catch (err) {
        payload = null;
    }
    return payload;
}

export function isAuthorized(rolesAllowed) {
    return (req, _res, next) => {
        // Get the token from the header
        let token;
        const authHeader = req.get('authorization');
        if (authHeader?.split(' ')[0] === 'Bearer') {
            token = authHeader?.split(' ')[1];
        }

        if (!token) {
            throw new HttpError(401, 'Token required');
        }
        const tokenPayload = getTokenPayload(token);
        if (!tokenPayload) {
            throw new HttpError(401, 'Invalid token');
        }
        if (!rolesAllowed.includes(tokenPayload.role)) {
            throw new HttpError(403, 'Access denied');
        }
        // Only admins have access to resources of other users
        if (
            tokenPayload.role !== 'admin' &&
            req.params?.userId &&
            tokenPayload.userId !== Number(req.params?.userId)
        ) {
            throw new HttpError(403, 'Access denied');
        }
        req.tokenPayload = tokenPayload;
        return next();
    };
}
