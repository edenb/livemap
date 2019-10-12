"use strict";
const jsonwebtoken = require('jsonwebtoken');

function getScopes(user) {
    let scopesByRole = new Array();
    scopesByRole['viewer'] = ['positions', 'staticlayers'];
    scopesByRole['manager'] = ['positions', 'staticlayers'];
    scopesByRole['admin'] = ['users', 'devices', 'positions', 'staticlayers'];
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
    let token = jsonwebtoken.sign({userId: user.user_id, scopes: scopes}, 'replacebysecretfromconfig', options);
    return token;
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
module.exports.checkScopes = checkScopes;
