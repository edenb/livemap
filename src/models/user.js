import bcrypt from 'bcrypt';
import config from 'config';
import { randomBytes } from 'node:crypto';
import { getEmptyQueryRes, queryDbAsync } from '../database/db.js';
import { ValidationError } from '../utils/error.js';

// In memory list of all users with their attributes
var users = [];

//
// Local functions
//

function generateAPIkey() {
    return randomBytes(8).toString('hex').toUpperCase();
}

function validateChangeUser(user, modUser) {
    // ToDo: add more checks here
    if (modUser.role === '') {
        return [{ code: 'roleEmpty', field: 'role', message: 'No role' }];
    }
    if (user.user_id === modUser.user_id && user.role !== modUser.role) {
        return [
            {
                code: 'roleNoOwnChange',
                field: 'role',
                message: 'Can not change own role',
            },
        ];
    }
    return null;
}

function validateUserId(modUser) {
    if (Number.isNaN(modUser.user_id)) {
        return [
            {
                code: 'userIdNotANumber',
                field: 'user_id',
                message: 'User ID is not a number',
            },
        ];
    }
    if (!Number.isSafeInteger(modUser.user_id)) {
        return [
            {
                code: 'userIdNotAnInteger',
                field: 'user_id',
                message: 'User ID is not an integer',
            },
        ];
    }
    if (modUser.user_id < 1 || modUser.user_id > 2147483647) {
        return [
            {
                code: 'userIdNotInRange',
                field: 'user_id',
                message: 'User ID is not in range',
            },
        ];
    }
    return null;
}

function validateAccountInput(modUser) {
    // ToDo: add more validations here

    // The full name should have a minimal length
    if (modUser.fullname.length < config.get('user.nameMinLength')) {
        return [
            {
                code: 'fullNameTooShort',
                field: 'fullname',
                message: 'Full name too short',
            },
        ];
    }
    // An API key should be unique (mainly for manually changed API keys)
    if (isKnownAPIkey(modUser.api_key, modUser)) {
        return [
            {
                code: 'apiKeyInUse',
                field: 'api_key',
                message: 'API key already in use',
            },
        ];
    }
    return null;
}

function validatePasswordInput(password) {
    // A password should have a minimal length
    if (!password) {
        return [
            {
                code: 'passwordEmpty',
                field: 'password',
                message: 'No password',
            },
        ];
    }
    if (password.length < config.get('user.pwdMinLength')) {
        return [
            {
                code: 'passwordTooShort',
                field: 'password',
                message: 'Password too short',
            },
        ];
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
    let passwordHash;
    let queryRes;
    let validationError;

    // If the API key is empty generate one
    if (!modUser.api_key || modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    validationError = validateChangeUser(user, modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    validationError = validateAccountInput(modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    validationError = validatePasswordInput(modUser.password);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    try {
        passwordHash = await createHash(modUser.password);
    } catch (err) {
        throw new ValidationError(err.message, 'failedHash');
    }

    queryRes = await queryDbAsync('insertUser', [
        modUser.username,
        modUser.fullname,
        modUser.email,
        modUser.role,
        modUser.api_key,
        passwordHash,
    ]);

    return queryRes;
}

export async function modifyUser(user, modUser) {
    let queryRes;
    let validationError;

    // If the API key is empty generate one
    if (!modUser.api_key || modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    validationError = validateUserId(modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    validationError = validateChangeUser(user, modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    validationError = validateAccountInput(modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }

    queryRes = await queryDbAsync('modifyUserById', [
        modUser.user_id,
        modUser.username,
        modUser.fullname,
        modUser.email,
        modUser.role,
        modUser.api_key,
    ]);

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
