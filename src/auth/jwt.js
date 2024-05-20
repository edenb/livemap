import config from 'config';
import jsonwebtoken from 'jsonwebtoken';

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
    return (req, res, next) => {
        // Get the token from the header (API requests) or from the session (web client requests)
        let token = null;
        if (req.headers.authorization) {
            let authorizationDirectives = req.headers.authorization.split(' ');
            if (
                authorizationDirectives.length === 2 &&
                authorizationDirectives[0] === 'Bearer'
            ) {
                token = authorizationDirectives[1];
            }
        }
        if (req.isAuthenticated() && req.session && req.session.token) {
            token = req.session.token;
        }

        if (token) {
            let tokenPayload = getTokenPayload(token);
            req.tokenPayload = tokenPayload;
            if (!tokenPayload) {
                res.status(401).send('Unauthorized. Invalid token');
            } else {
                if (rolesAllowed.includes(tokenPayload.role)) {
                    return next();
                }
                res.status(403).send('Forbidden');
            }
        } else {
            res.status(401).send('Unauthorized. Token required');
        }
    };
}
