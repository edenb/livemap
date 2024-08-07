import bcrypt from 'bcrypt';
import config from 'config';
import { randomBytes } from 'node:crypto';
import { getEmptyQueryRes, queryDbAsync } from '../database/db.js';

// In memory list of all users with their attributes
var users = [];

//
// Local functions
//

function generateAPIkey() {
    return randomBytes(8).toString('hex').toUpperCase();
}

function checkChangesAllowed(user, modUser) {
    // ToDo: add more checks here
    if (modUser.role === '') {
        return 'No role selected';
    }
    if (
        user.role === 'admin' &&
        user.user_id === modUser.user_id &&
        user.role !== modUser.role
    ) {
        return 'You can not change your own role';
    }
    return null;
}

function validateAccountInput(modUser) {
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

function validatePasswordInput(password) {
    // A password should have a minimal length
    if (!password) {
        return 'No password';
    }
    if (password.length < config.get('user.pwdMinLength')) {
        return 'Password too short';
    }
    return null;
}

//
// Exported modules
//

export async function getAllUsers() {
    let queryRes = getEmptyQueryRes();
    try {
        queryRes = await queryDbAsync('getAllUsers', []);
        users = queryRes.rows;
        return queryRes;
    } catch (err) {
        queryRes.userMessage = 'Unable to get users';
        return queryRes;
    }
}

export async function getUserByField(field, value) {
    let queryRes = getEmptyQueryRes();
    let queryDefinition = '';
    if (field === 'user_id') {
        queryDefinition = 'getUserByUserId';
    }
    if (field === 'username') {
        queryDefinition = 'getUserByUsername';
    }
    if (field === 'api_key') {
        queryDefinition = 'getUserByApiKey';
    }
    if (queryDefinition !== '') {
        try {
            queryRes = await queryDbAsync(queryDefinition, [value]);
        } catch (err) {
            queryRes.userMessage = 'Unable to get user';
            return queryRes;
        }
    }
    return queryRes;
}

export async function addUser(user, modUser) {
    let queryRes = getEmptyQueryRes();
    let userMessage;
    let hash;
    // If the API key is empty generate one
    if (!modUser.api_key || modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    userMessage = checkChangesAllowed(user, modUser);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        queryRes.rowCount = -2;
        return queryRes;
    }
    userMessage = validateAccountInput(modUser);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        queryRes.rowCount = -2;
        return queryRes;
    }
    userMessage = validatePasswordInput(modUser.password);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        queryRes.rowCount = -2;
        return queryRes;
    }
    try {
        hash = await createHash(modUser.password);
    } catch (err) {
        queryRes.userMessage = 'Hashing failed';
        queryRes.rowCount = -2;
        return queryRes;
    }
    if (typeof modUser.user_id === 'undefined' || modUser.user_id <= 0) {
        try {
            queryRes = await queryDbAsync('insertUser', [
                modUser.username,
                modUser.fullname,
                modUser.email,
                modUser.role,
                modUser.api_key,
                hash,
            ]);
        } catch (err) {
            queryRes.userMessage = 'Unable to add user';
        }
    }
    return queryRes;
}

export async function modifyUser(user, modUser) {
    let queryRes = getEmptyQueryRes();
    let userMessage;
    // If the API key is empty generate one
    if (modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    userMessage = checkChangesAllowed(user, modUser);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        queryRes.rowCount = -2;
        return queryRes;
    }
    userMessage = validateAccountInput(modUser);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        queryRes.rowCount = -2;
        return queryRes;
    }
    try {
        queryRes = await queryDbAsync('modifyUserById', [
            modUser.user_id,
            modUser.username,
            modUser.fullname,
            modUser.email,
            modUser.role,
            modUser.api_key,
        ]);
    } catch (err) {
        queryRes.userMessage = 'Unable to change details';
    }
    return queryRes;
}

export async function changePassword(user, curPwd, newPwd, confirmPwd) {
    let queryRes = getEmptyQueryRes();
    let authOK = false;

    // If a user has no password yet, any current password will work (for legacy UI)
    if (user.password === null) {
        authOK = true;
    } else {
        authOK = await checkPassword(curPwd, user.password);
    }
    if (authOK) {
        queryRes = await resetPassword(user, newPwd, confirmPwd);
        return queryRes;
    } else {
        queryRes.userMessage = 'Old password incorrect';
        queryRes.rowCount = -2;
        return queryRes;
    }
}

export async function resetPassword(user, newPwd, confirmPwd) {
    let queryRes = getEmptyQueryRes();

    const userMessage = validatePasswordInput(newPwd);
    if (userMessage !== null) {
        queryRes.userMessage = userMessage;
        queryRes.rowCount = -2;
        return queryRes;
    }
    if (newPwd !== confirmPwd) {
        queryRes.userMessage = 'New passwords mismatch';
        queryRes.rowCount = -2;
        return queryRes;
    }
    let newHash;
    try {
        newHash = await createHash(newPwd);
    } catch (err) {
        queryRes.userMessage = 'Hashing failed';
        queryRes.rowCount = -2;
        return queryRes;
    }
    try {
        queryRes = await queryDbAsync('changePwdByUsername', [
            user.username,
            newHash,
        ]);
        if (queryRes.rowCount <= 0) {
            queryRes.userMessage = 'User not found';
        }
    } catch (err) {
        queryRes.userMessage = 'Failed to change password';
        return queryRes;
    }
    return queryRes;
}

export async function createHash(password) {
    const passwordHash = await bcrypt.hash(
        password,
        config.get('user.pwdSaltRounds'),
    );
    return passwordHash;
}

export async function checkPassword(password, passwordHash) {
    if (password === null) {
        return true;
    } else {
        const match = await bcrypt.compare(password || '', passwordHash);
        return match;
    }
}

export async function deleteUser(user, modUser) {
    let queryRes = getEmptyQueryRes();
    if (user.user_id === modUser.user_id) {
        queryRes.userMessage = 'You can not delete your own account';
        queryRes.rowCount = -2;
    } else {
        try {
            queryRes = await queryDbAsync('deleteUser', [modUser.user_id]);
        } catch (err) {
            queryRes.userMessage = 'Failed to delete user';
        }
    }
    return queryRes;
}

export function isKnownAPIkey(apiKey, ignoreUser) {
    var i, ignoreId;

    if (ignoreUser === null) {
        ignoreId = -1;
    } else {
        ignoreId = ignoreUser.user_id;
    }

    i = 0;
    while (
        i < users.length &&
        (users[i].api_key !== apiKey || users[i].user_id === ignoreId)
    ) {
        i++;
    }
    if (i !== users.length) {
        return true;
    } else {
        return false;
    }
}
