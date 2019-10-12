"use strict";
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const usr = require('../models/user');

// Passport session set-up
passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser(async (req, id, done) => {
    const queryRes = await usr.getUserByField('user_id', id);
    if (queryRes.rowCount === 0) {
        done(null, {});
    } else {
        done(null, queryRes.rows[0]);
    }
});

passport.use(new LocalStrategy({usernameField: 'username', passwordField: 'password', passReqToCallback: true},
    async (req, username, password, done) => {
        const queryRes = await usr.getUserByField('username', username);
        if (queryRes.rowCount === 0) {
            req.flash('error', 'No such user');
            req.session.save(() => {
                return done(null, false);
            });
        } else {
            const authOK = await usr.checkPassword(queryRes.rows[0], password);
            if (authOK) {
                return done(null, queryRes.rows[0]);
            } else {
                req.flash('error', 'Wrong password');
                req.session.save(() => {
                    return done(null, false);
                });
            }
        }
    })
);

module.exports = passport;
