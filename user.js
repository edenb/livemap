var config = require('config');
var db = require('./db.js');
var bcrypt = require('bcrypt');
var shortid = require('shortid');

var users = [];

function generateAPIkey(user, callback) {
    var generatedAPIkey;

    generatedAPIkey = shortid.generate();

    db.queryDb('changeAPIkeyByUsername', [user.username, generatedAPIkey], function (err, rows, result) {
        user.api_key = generatedAPIkey;
        return callback(err, user, result);
    });
}

//
// Exported modules
//

function loadUsersFromDB(callback) {
    db.queryDb('getAllUsers', [], function (err, rows, result) {
        if (err === null) {
            if (rows === null) {
                users = [];
            } else {
                users = rows;
            }
            return callback(null);
        } else {
            return callback(err);
        }
    });
}

function findUser(field, val, callback) {
    var queryDefinition = null;
    if (field === 'id') {
        queryDefinition = 'findUserById';
    }
    if (field === 'username') {
        queryDefinition = 'findUserByUsername';
    }
    if (queryDefinition !== null) {
        db.queryDb(queryDefinition, [val], function (err, rows, result) {
            if (typeof callback === 'function') {
                if (result.rowCount === 0) {
                    return callback(err, null);
                } else {
                    // Every user gets an API key. Generate one if not present.
                    if (rows[0].api_key === null) {
                        generateAPIkey(rows[0], function (err, user, result) {
                            if (result.rowCount === 0) {
                                return callback(err, null);
                            } else {
                                return callback(err, user);
                            }
                        });
                    } else {
                        return callback(err, rows[0]);
                    }
                }
            }
        });
    }
}

function changeDetails(user, fullname, email, callback) {
    if (fullname.length < config.get('user.nameMinLength')) {
        return callback('Full name too short');
    }
    db.queryDb('changeDetailsByUsername', [user.username, fullname, email], function (err, rows, result) {
        if (err !== null) {
            return callback(err);
        } else {
            if (result.rowCount === 0) {
                return callback('Unable to change details');
            } else {
                return callback(null);
            }
        }
    });
}

function changePassword(user, curPwd, newPwd, confirmPwd, callback) {
    // The new password should have a minimal length
    if (newPwd.length < config.get('user.pwdMinLength')) {
        return callback('New password too short');
    }
    if (newPwd !== confirmPwd) {
        return callback('New passwords mismatch');
    }
    checkPassword(user, curPwd, function (authOK) {
        // If a user has no password yet, any current password will work
        if ((user.password === null) || authOK) {
            bcrypt.hash(newPwd, config.get('user.pwdSaltRounds'), function (err, newHash) {
                if (err) {
                    return callback('Hashing failed');
                }
                db.queryDb('changePwdByUsername', [user.username, newHash], function (err, rows, result) {
                    if (err !== null) {
                        return callback(err);
                    } else {
                        if (result.rowCount === 0) {
                            return callback('User not found');
                        } else {
                            return callback(null);
                        }
                    }
                });
            });
        } else {
            return callback('Old password incorrect');
        }
    });
}

function checkPassword(user, password, callback) {
    if (user !== null) {
        if (user.password === null) {
            callback(true);
        } else {
            bcrypt.compare(password, user.password, function (err, res) {
                if (res) {
                    callback(true);
                } else {
                    callback(false);
                }
            });
        }
    } else {
        callback(false);
    }
}

function isKnownAPIkey(apiKey) {
    var i = 0;

    while ((i < users.length) && (users[i].api_key !== apiKey)) {
        i++;
    }
    if (i !== users.length) {
        return true;
    } else {
        return false;
    }
}

module.exports.loadUsersFromDB = loadUsersFromDB;
module.exports.findUser = findUser;
module.exports.changeDetails = changeDetails;
module.exports.changePassword = changePassword;
module.exports.checkPassword = checkPassword;
module.exports.isKnownAPIkey = isKnownAPIkey;
