import session from 'express-session';
import { bindStore, getStore } from '../database/db.js';

export function sessionMiddleware(name, secret, cookie) {
    // Store sessions in the database
    bindStore(session);
    return session({
        name,
        store: getStore(),
        secret,
        cookie,
        resave: false,
        saveUninitialized: true,
        unset: 'keep',
    });
}
