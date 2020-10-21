"use strict";
const jsonwebtoken = require('jsonwebtoken');

function getScopes(user) {
    let scopesByRole = new Array();
    scopesByRole['viewer'] = ['account', 'positions', 'devices', 'staticlayers'];
    scopesByRole['manager'] = ['account', 'positions', 'devices', 'staticlayers'];
    scopesByRole['admin'] = ['account', 'users', 'devices', 'positions', 'staticlayers'];
    if (user.role in scopesByRole) {
        return scopesByRole[user.role];
    } else {
        return [];
    }
}

//
// Exported modules
//

function getNewToken(user) {
    let options = {algorithm: 'HS512'};
    let scopes = getScopes(user);
    let token = jsonwebtoken.sign({userId: user.user_id, role: user.role, scopes: scopes},
        'replacebysecretfromconfig',
        options);
    return token;
}

function getTokenPayload(token) {
    let payload = {};
    let options = {algorithm: 'HS512'};
    try {
        payload = jsonwebtoken.verify(token, 'replacebysecretfromconfig', options);
    } catch(err) {
        payload = {};
    }
    return payload;
}

function getUserId(token) {
    // If the token comes from the authorization header remove the 'Bearer' part
    const tokenElements = token.split(' ');
    if (tokenElements.length === 2 && tokenElements[0] === 'Bearer') {
        token = tokenElements[1];
    }
    const payload = getTokenPayload(token);
    if (payload.userId) {
        return parseInt(payload.userId) || -1;
    } else {
        return -1;
    }
}

function checkScopes(scopes) {
    return (req, res, next) => {
        // Get the token from the header (API requests) or from the session (web client requests)
        let token = '';
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            token = req.headers.authorization.split(' ')[1];
        }
        if (req.isAuthenticated() && req.session && req.session.token) {
            token = req.session.token;
        }
        if (token !== '') {
            try {
                let options = {algorithm: 'HS512'};
                let decoded = jsonwebtoken.verify(token, 'replacebysecretfromconfig', options);
                req.decodedToken = decoded;
                for (let i=0; i<decoded.scopes.length; i++) {
                    for (let j=0; j<scopes.length; j++) {
                        if(scopes[j] === decoded.scopes[i]) return next();
                    }
                }
                res.status(401).send('Unauthorized. Invalid scope');
            } catch(err) {
                res.status(401).send('Unauthorized. Invalid token');
            }
        } else {
            res.status(401).send('Unauthorized. Token required');
        }
    }
}

module.exports.getNewToken = getNewToken;
module.exports.getTokenPayload = getTokenPayload;
module.exports.getUserId = getUserId;
module.exports.checkScopes = checkScopes;
