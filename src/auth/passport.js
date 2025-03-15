import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import * as usr from '../models/user.js';

// Passport session set-up
passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser(async (_req, id, done) => {
    const { rows, rowCount } = await usr.getUserByField('user_id', id);
    if (rowCount > 0) {
        done(null, rows[0]);
    } else {
        done(null, {});
    }
});

passport.use(
    new LocalStrategy(
        {
            usernameField: 'username',
            passwordField: 'password',
            passReqToCallback: true,
        },
        async (req, username, password, done) => {
            const { rows, rowCount } = await usr.getUserByField(
                'username',
                username,
            );
            if (rowCount > 0) {
                const authOK = await usr.credentialsMatch(
                    rows[0].user_id,
                    password,
                );
                if (authOK) {
                    return done(null, rows[0]);
                } else {
                    // No sessions with API logins, so don't store flash message and save sessions
                    try {
                        req.flash('error', 'Wrong password');
                        req.session.save(() => {
                            return done(null, false);
                        });
                    } catch (err) {
                        return done(null, false);
                    }
                }
            } else {
                // No sessions with API logins, so don't store flash message and save sessions
                try {
                    req.flash('error', 'No such user');
                    req.session.save(() => {
                        return done(null, false);
                    });
                } catch (err) {
                    return done(null, false);
                }
            }
        },
    ),
);

export default passport;
