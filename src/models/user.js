import bcrypt from 'bcrypt';
import config from 'config';
import { randomBytes } from 'node:crypto';
import { getEmptyQueryRes, queryDbAsync } from '../database/db.js';
import { ValidationError } from '../utils/error.js';

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

function validateUserId(user_id) {
    if (Number.isNaN(user_id)) {
        return [
            {
                code: 'userIdNotANumber',
                field: 'user_id',
                message: 'User ID is not a number',
            },
        ];
    }
    if (!Number.isSafeInteger(user_id)) {
        return [
            {
                code: 'userIdNotAnInteger',
                field: 'user_id',
                message: 'User ID is not an integer',
            },
        ];
    }
    if (user_id < 1 || user_id > 2147483647) {
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

async function validateAccountInput(modUser) {
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
    if (await isKnownAPIkey(modUser.api_key, modUser)) {
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
    const queryRes = await queryDbAsync('getAllUsers', []);
    return queryRes;
}

export async function getUserByField(field, value) {
    let key;
    let validationError;

    if (field === 'user_id') {
        validationError = validateUserId(value);
        if (validationError) {
            throw new ValidationError(validationError);
        }
        key = 'getUserByUserId';
    }
    if (field === 'username') {
        key = 'getUserByUsername';
    }
    if (field === 'api_key') {
        key = 'getUserByApiKey';
    }
    if (!key) {
        throw new TypeError(`No key for field: ${field}`);
    }

    const queryRes = await queryDbAsync(key, [value]);
    return queryRes;
}

export async function addUser(user, modUser) {
    let passwordHash;
    let validationError;

    // If the API key is empty generate one
    if (!modUser.api_key || modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    validationError = validateChangeUser(user, modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    validationError = await validateAccountInput(modUser);
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

    const queryRes = await queryDbAsync('insertUser', [
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
    let validationError;

    // If the API key is empty generate one
    if (!modUser.api_key || modUser.api_key === '') {
        modUser.api_key = generateAPIkey();
    }
    validationError = validateUserId(modUser.user_id);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    validationError = validateChangeUser(user, modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    validationError = await validateAccountInput(modUser);
    if (validationError) {
        throw new ValidationError(validationError);
    }

    const queryRes = await queryDbAsync('modifyUserById', [
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
    let validationError;

    if (user.user_id === modUser.user_id) {
        validationError = [
            {
                code: 'accountNoOwnDelete',
                field: 'user_id',
                message: 'Can not delete own account',
            },
        ];
        throw new ValidationError(validationError);
    }
    validationError = validateUserId(modUser.user_id);
    if (validationError) {
        throw new ValidationError(validationError);
    }

    const queryRes = await queryDbAsync('deleteUser', [modUser.user_id]);
    return queryRes;
}

export async function isKnownAPIkey(apiKey, ignoreUser) {
    try {
        const queryRes = await getAllUsers();
        const foundUser = queryRes.rows.find(
            (e) => e.api_key === apiKey && e.api_key !== ignoreUser?.api_key,
        );
        if (foundUser) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}
