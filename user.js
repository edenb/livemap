var config = require('config');
var db = require('./db.js');
var bcrypt = require('bcrypt');
var shortid = require('shortid');

// In memory list of all users with their attributes
var users = [];

//
// Local functions
//

function generateAPIkey() {
    return shortid.generate();
}

function checkChangesAllowed(user, modUser) {
    // ToDo: add more checks here
    if (modUser.role === '') {
        return 'No role selected';
    }
    if (user.role === 'admin' && user.user_id === modUser.user_id && user.role !== modUser.role) {
        return 'You can not change your own role';
    }
    return null;
}

function validateChanges(user, modUser) {
    // ToDo: add more validations here

    // The full name should have a minimal length
    if (modUser.fullname.length < config.get('user.nameMinLength')) {
        return 'Full name too short';
    }
    // An API key should be unique (mainly for manually changed API keys)
    if (isKnownAPIkey(modUser.api_key, modUser)) {
        return 'API key already in use';
    }
    return null;
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

function getAllUsers(callback) {
    loadUsersFromDB(function (err) {
        if (err === null) {
            callback(users);
        } else {
            callback([]);
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
                    return callback(err, rows[0]);
                }
            }
        });
    }
}

function changeDetails(user, modUser, callback) {
    var err;

    // If the API key is empty generate one
    if (modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    err = checkChangesAllowed(user, modUser);
    if (err !== null) {
        return callback(err);
    }
    err = validateChanges(user, modUser);
    if (err !== null) {
        return callback(err);
    }
    if (modUser.user_id === 0) {
        db.queryDb('insertUser', [modUser.username, modUser.fullname, modUser.email, modUser.role, modUser.api_key], function (err, rows, result) {
            if (err !== null) {
                return callback(err);
            } else {
                if (result.rowCount === 0) {
                    return callback('Unable to add user');
                } else {
                    return callback(null);
                }
            }
        });
    } else {
        db.queryDb('changeDetailsById', [modUser.user_id, modUser.username, modUser.fullname, modUser.email, modUser.role, modUser.api_key], function (err, rows, result) {
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

function deleteUser(user, modUser, callback) {
    if (user.user_id === modUser.user_id) {
        callback('You can not delete your own account');
    } else {
        db.queryDb('deleteUser', [modUser.user_id], function (err, rows, result) {
            if (err === null && rows !== null) {
                return callback(null);
            } else {
                return callback('Failed to delete user');
            }
        });
    }
}

function isKnownAPIkey(apiKey, ignoreUser) {
    var i, ignoreId;

    if (ignoreUser === null) {
        ignoreId = -1;
    } else {
        ignoreId = ignoreUser.user_id;
    }

    i = 0;
    while ((i < users.length) && (users[i].api_key !== apiKey || users[i].user_id === ignoreId)) {
        i++;
    }
    if (i !== users.length) {
        return true;
    } else {
        return false;
    }
}

module.exports.loadUsersFromDB = loadUsersFromDB;
module.exports.getAllUsers = getAllUsers;
module.exports.findUser = findUser;
module.exports.changeDetails = changeDetails;
module.exports.changePassword = changePassword;
module.exports.checkPassword = checkPassword;
module.exports.deleteUser = deleteUser;
module.exports.isKnownAPIkey = isKnownAPIkey;
