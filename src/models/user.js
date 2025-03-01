import bcrypt from 'bcrypt';
import config from 'config';
import { randomBytes } from 'node:crypto';
import { queryDbAsync } from '../database/db.js';
import { ValidationError } from '../utils/error.js';

//
// Local functions
//

function generateAPIkey() {
    return randomBytes(8).toString('hex').toUpperCase();
}

async function createHash(password) {
    const passwordHash = await bcrypt.hash(
        password,
        config.get('user.pwdSaltRounds'),
    );
    return passwordHash;
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

    const passwordHash = await createHash(modUser.password);
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

export async function changePassword(user_id, newPwd, confirmPwd, currentPwd) {
    if (!(await credentialsMatch(user_id, currentPwd))) {
        const validationError = [
            {
                code: 'userPasswordMismatch',
                field: 'password',
                message: 'User and password do not match',
            },
        ];
        throw new ValidationError(validationError);
    }

    const queryRes = await resetPassword(user_id, newPwd, confirmPwd);
    return queryRes;
}

export async function resetPassword(user_id, newPwd, confirmPwd) {
    let validationError;

    validationError = validatePasswordInput(newPwd);
    if (validationError) {
        throw new ValidationError(validationError);
    }
    if (newPwd !== confirmPwd) {
        validationError = [
            {
                code: 'newPasswordsMismatch',
                field: 'password',
                message: 'New passwords do not match',
            },
        ];
        throw new ValidationError(validationError);
    }

    const newPasswordHash = await createHash(newPwd);
    const queryRes = await queryDbAsync('changePwdByUserId', [
        user_id,
        newPasswordHash,
    ]);
    return queryRes;
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

export async function credentialsMatch(user_id, password) {
    const queryRes = await queryDbAsync('getPwdByUserId', [user_id]);
    if (queryRes.rowCount > 0) {
        const currentPasswordHash = queryRes.rows[0].password;
        const match = await bcrypt.compare(password, currentPasswordHash);
        return match;
    } else {
        return false;
    }
}

export async function isKnownAPIkey(apiKey, modUser) {
    try {
        const queryRes = await getAllUsers();
        const foundUser = queryRes.rows.find(
            (e) => e.api_key === apiKey && e.user_id !== modUser?.user_id,
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
