"use strict";
const config = require('config');
const bcrypt = require('bcrypt');
const shortid = require('shortid');
const db = require('../database/db');

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

async function getAllUsers() {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('getAllUsers', []);
        users = queryRes.rows;
        return queryRes;
    } catch(err) {
        queryRes.userMessage = 'Unable to get users';
        return queryRes;
    }
}

async function getUserByField(field, value) {
    let queryRes = db.getEmptyQueryRes();
    let queryDefinition = '';
    if (field === 'user_id') {
        queryDefinition = 'getUserByUserId';
    }
    if (field === 'username') {
        queryDefinition = 'getUserByUsername';
    }
    if (queryDefinition !== '') {
        try {
            queryRes = await db.queryDbAsync(queryDefinition, [value]);
        } catch(err) {
            queryRes.userMessage = 'Unable to get user';
            return queryRes;
        }
    }
    return queryRes;
}

async function changeDetails(user, modUser) {
    let queryRes = db.getEmptyQueryRes();
    let userMessage;
    // If the API key is empty generate one
    if (modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    userMessage = checkChangesAllowed(user, modUser);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        return queryRes;
    }
    userMessage = validateChanges(user, modUser);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        return queryRes;
    }
    if (typeof modUser.user_id === 'undefined' || modUser.user_id === 0) {
        try {
            queryRes = await db.queryDbAsync('insertUser', [modUser.username, modUser.fullname, modUser.email, modUser.role, modUser.api_key]);
        } catch(err) {
            queryRes.userMessage = 'Unable to add user';
        }
    } else {
        try {
            queryRes = await db.queryDbAsync('changeDetailsById', [modUser.user_id, modUser.username, modUser.fullname, modUser.email, modUser.role, modUser.api_key]);
        } catch(err) {
            queryRes.userMessage = 'Unable to change details';
        }
    }
    return queryRes;
}

async function changePassword(user, curPwd, newPwd, confirmPwd) {
    let queryRes = db.getEmptyQueryRes();
     // The new password should have a minimal length
    if (newPwd.length < config.get('user.pwdMinLength')) {
        queryRes.userMessage = 'New password too short';
        return queryRes;
    }
    if (newPwd !== confirmPwd) {
        queryRes.userMessage = 'New passwords mismatch';
        return queryRes;
    }
    const authOK = await checkPassword(user, curPwd);
    // If a user has no password yet, any current password will work
    if ((user.password === null) || authOK) {
        let newHash;
        try {
            newHash = await bcrypt.hash(newPwd, config.get('user.pwdSaltRounds'));
        } catch(err) {
            queryRes.userMessage = 'Hashing failed';
            return queryRes;
        }
        try {
            queryRes = await db.queryDbAsync('changePwdByUsername', [user.username, newHash]);
            if (queryRes.rowCount <= 0) {
                queryRes.userMessage = 'User not found';
            }
        } catch(err) {
            queryRes.userMessage = 'Failed to change password';
            return queryRes;
        }
    } else {
        queryRes.userMessage = 'Old password incorrect';
    }
    return queryRes;
}

async function checkPassword(user, password) {
    if (user !== null) {
        if (user.password === null) {
            return true;
        } else {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                return true;
            } else {
                return false;
            }
        }
    } else {
        return false;
    }
}

async function deleteUser(user, modUser) {
    let queryRes = db.getEmptyQueryRes();
    if (user.user_id === modUser.user_id) {
        queryRes.userMessage = 'You can not delete your own account';
    } else {
        try {
            queryRes = await db.queryDbAsync('deleteUser', [modUser.user_id]);
        } catch(err) {
            queryRes.userMessage = 'Failed to delete user';
        }
    }
    return queryRes;
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

module.exports.getAllUsers = getAllUsers;
module.exports.getUserByField = getUserByField;
module.exports.changeDetails = changeDetails;
module.exports.changePassword = changePassword;
module.exports.checkPassword = checkPassword;
module.exports.deleteUser = deleteUser;
module.exports.isKnownAPIkey = isKnownAPIkey;
