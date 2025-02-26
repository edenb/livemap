import config from 'config';
import pgStore from 'connect-pg-simple';
import { readFile } from 'node:fs';
import pg from 'pg';
import pgConnectionString from 'pg-connection-string';
import { load, invalidate, save } from './dbcache.js';
import Logger from '../utils/logger.js';

const logger = Logger(import.meta.url);
let sessionStore;
let queryDef = [];

queryDef.getAllUsers = {
    qstr: 'SELECT user_id, username, fullname, email, role, api_key FROM users',
    readTables: ['users'],
    writeTables: [],
    cached: true,
};
queryDef.getUserByUserId = {
    qstr: 'SELECT * FROM users WHERE user_id = $1',
    readTables: ['users'],
    writeTables: [],
    cached: true,
};
queryDef.getUserByUsername = {
    qstr: 'SELECT * FROM users WHERE username = $1',
    readTables: ['users'],
    writeTables: [],
    cached: true,
};
queryDef.getUserByApiKey = {
    qstr: 'SELECT * FROM users WHERE api_key = $1',
    readTables: ['users'],
    writeTables: [],
    cached: true,
};
queryDef.insertUser = {
    qstr: 'INSERT INTO users(username, fullname, email, role, api_key, password) VALUES ($1, $2, $3, $4, $5, $6)',
    readTables: [],
    writeTables: ['users'],
    cached: false,
};
queryDef.modifyUserById = {
    qstr: 'UPDATE users SET username = $2, fullname = $3, email = $4, role = $5, api_key = $6 WHERE user_id = $1',
    readTables: [],
    writeTables: ['users'],
    cached: false,
};
queryDef.getPwdByUserId = {
    qstr: 'SELECT password FROM users WHERE user_id = $1',
    readTables: ['users'],
    writeTables: [],
    cached: true,
};
queryDef.changePwdByUserId = {
    qstr: 'UPDATE users SET password = $2 WHERE user_id = $1',
    readTables: [],
    writeTables: ['users'],
    cached: false,
};
queryDef.deleteUser = {
    qstr: 'DELETE FROM users WHERE user_id = $1',
    readTables: [],
    writeTables: ['users'],
    cached: false,
};
queryDef.getAllDevices = {
    qstr: 'SELECT * FROM devices',
    readTables: ['devices'],
    writeTables: [],
    cached: true,
};
queryDef.getAllowedDevices = {
    qstr: 'SELECT devices.* FROM devices INNER JOIN shared_devices ON devices.device_id = shared_devices.device_id WHERE shared_devices.user_id = $1 UNION SELECT devices.* FROM devices INNER JOIN users ON devices.api_key = users.api_key WHERE users.user_id = $1',
    readTables: ['devices', 'shared_devices', 'users'],
    writeTables: [],
    cached: true,
};
queryDef.getOwnedDevicesByUserId = {
    qstr: 'SELECT devices.*, array_agg(shared_users.username) AS shared, max(users.username) AS owner FROM devices JOIN users ON devices.api_key = users.api_key LEFT JOIN shared_devices ON shared_devices.device_id = devices.device_id LEFT JOIN users AS shared_users ON shared_users.user_id = shared_devices.user_id WHERE users.user_id = $1 GROUP BY devices.device_id ORDER BY devices.device_id',
    readTables: ['devices', 'shared_devices', 'users'],
    writeTables: [],
    cached: true,
};
queryDef.getSharedDevicesByUserId = {
    qstr: 'SELECT devices.device_id, devices.alias, users.username AS owner FROM devices INNER JOIN shared_devices ON devices.device_id = shared_devices.device_id INNER JOIN users ON devices.api_key = users.api_key WHERE shared_devices.user_id = $1',
    readTables: ['devices', 'shared_devices', 'users'],
    writeTables: [],
    cached: true,
};
queryDef.addDeviceByUserId = {
    qstr: 'INSERT INTO devices(api_key, identifier, alias, fixed_loc_lat, fixed_loc_lon) SELECT api_key, $2, $3, $4, $5 FROM users WHERE user_id = $1 RETURNING *',
    readTables: ['users'],
    writeTables: ['devices'],
    cached: false,
};
queryDef.insertDevice = {
    qstr: 'INSERT INTO devices(api_key, identifier, alias) VALUES ($1, $2, $3) RETURNING *',
    readTables: [],
    writeTables: ['devices'],
    cached: false,
};
queryDef.modifyDeviceById = {
    qstr: 'UPDATE devices SET alias = $2, fixed_loc_lat = $3, fixed_loc_lon = $4 WHERE device_id = $1',
    readTables: [],
    writeTables: ['devices'],
    cached: false,
};
queryDef.modifyDeviceByUserId = {
    qstr: 'UPDATE devices d SET alias = $3, fixed_loc_lat = $4, fixed_loc_lon = $5 FROM users u WHERE d.api_key = u.api_key  AND d.device_id = $2 AND u.user_id = $1',
    readTables: ['users'],
    writeTables: ['devices'],
    cached: false,
};
queryDef.deleteDevices = {
    qstr: 'DELETE FROM devices WHERE device_id = ANY($1::int[])',
    readTables: [],
    writeTables: ['devices'],
    cached: false,
};
queryDef.deleteDevicesByUserId = {
    qstr: 'DELETE FROM devices WHERE device_id = ANY($2::int[]) AND api_key IN (SELECT api_key FROM users WHERE user_id = $1)',
    readTables: ['users'],
    writeTables: ['devices'],
    cached: false,
};
queryDef.addSharedUser = {
    qstr: 'INSERT INTO shared_devices (device_id, user_id) SELECT d.device_id, u.user_id FROM devices d, users u WHERE u.username = $1 AND d.device_id = ANY($2::int[]) AND NOT EXISTS (SELECT * FROM shared_devices WHERE device_id = d.device_id AND user_id = u.user_id)',
    readTables: ['devices', 'users'],
    writeTables: ['shared_devices'],
    cached: false,
};
queryDef.addSharedUserByUserId = {
    qstr: 'INSERT INTO shared_devices (device_id, user_id) SELECT d.device_id, u.user_id FROM devices d, users u WHERE d.api_key IN (SELECT api_key FROM users WHERE user_id = $1) AND u.user_id != $1 AND u.username = $2 AND d.device_id = ANY($3::int[]) AND NOT EXISTS (SELECT * FROM shared_devices WHERE device_id = d.device_id AND user_id = u.user_id)',
    readTables: ['devices', 'users'],
    writeTables: ['shared_devices'],
    cached: false,
};
queryDef.deleteSharedUser = {
    qstr: 'DELETE FROM shared_devices WHERE user_id = (SELECT user_id FROM users WHERE username = $1) AND device_id = ANY($2::int[])',
    readTables: ['users'],
    writeTables: ['shared_devices'],
    cached: false,
};
queryDef.deleteSharedUserByUserId = {
    qstr: 'DELETE FROM shared_devices WHERE user_id = (SELECT user_id FROM users WHERE username = $2) AND device_id = ANY($3::int[]) AND device_id IN (SELECT d.device_id FROM devices d INNER JOIN users  u ON d.api_key = u.api_key WHERE u.user_id = $1)',
    readTables: ['devices', 'users'],
    writeTables: ['shared_devices'],
    cached: false,
};
queryDef.getLastPositions = {
    qstr: 'SELECT locations.*, devices.alias FROM locations INNER JOIN devices ON locations.device_id = devices.device_id WHERE location_id IN (SELECT max(location_id) FROM locations WHERE device_id IN (SELECT device_id FROM shared_devices WHERE user_id = $1 UNION SELECT devices.device_id FROM devices INNER JOIN users ON devices.api_key = users.api_key WHERE users.user_id = $1) GROUP BY device_id)',
    readTables: ['locations', 'devices', 'shared_devices', 'users'],
    writeTables: [],
    cached: true,
};
queryDef.insertPosition = {
    qstr: 'INSERT INTO locations(device_id, device_id_tag, loc_timestamp, loc_lat, loc_lon, loc_type, loc_attr, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, Now())',
    readTables: [],
    writeTables: ['locations'],
    cached: false,
};
queryDef.findSessionById = {
    qstr: 'SELECT sess FROM sessions WHERE sid = $1',
    readTables: ['sessions'],
    writeTables: [],
    cached: false,
};
queryDef.getNumberOfTables = {
    qstr: "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
    readTables: [],
    writeTables: [],
    cached: false,
};

export function getEmptyQueryRes() {
    const emptyQueryRes = {
        rows: [],
        rowCount: -1,
    };
    return emptyQueryRes;
}

// Initialize the pool
// Get the PostgreSQL login details from the config.
// Form: postgres://<PGUSER>:<PGPASS>@<URL>/<PGDATABASE>
// To set environment variable:
//  set DATABASE_URL=user:pass@abc.com/table (Windows)
//  export DATABASE_URL=user:pass@abc.com/table (*nix)
const dbConfig = pgConnectionString.parse(config.get('db.url'));
// Overwrite tls.connect options to allow self signed certs
if (config.get('db.ssl')) {
    dbConfig.ssl = { rejectUnauthorized: false };
}
const pgPool = new pg.Pool(dbConfig);

// The pool emits an error if a backend or network error occurs
// on any idle client. This is fatal so exit
pgPool.on('error', (err) => {
    logger.error(`Unexpected error on idle client. ${err.message}`);
    process.exit(1);
});

//
// Database operations with predefined queries
//

export async function queryDbAsync(key, sqlParams) {
    let dbQueryRes = getEmptyQueryRes();

    if (typeof queryDef[key] !== 'undefined') {
        // Try to get the query result from cache
        if (queryDef[key].cached) {
            const cachedQueryRes = load(queryDef[key], sqlParams);
            if (cachedQueryRes !== null) {
                logger.debug(`queryDb - cached: ${key}`);
                return cachedQueryRes;
            }
        }

        // Query the database
        dbQueryRes = await pgPool.query(queryDef[key].qstr, sqlParams || []);

        // Update cache
        invalidate(queryDef[key]);
        if (queryDef[key].cached) {
            save(queryDef[key], sqlParams, dbQueryRes);
        }
    } else {
        throw new Error(`Database query failed. No query for key: ${key}`);
    }

    return dbQueryRes;
}

//
// Database operations with queries from file
//

function readQueryFromFile(fileName) {
    return new Promise((resolve, reject) => {
        readFile(fileName, (fileError, fileData) => {
            if (fileError === null) {
                resolve(fileData);
            } else {
                reject(fileError);
            }
        });
    });
}

async function queryDbFromFile(fileName) {
    const fileData = await readQueryFromFile(fileName);
    const pgClient = await pgPool.connect();
    let result;
    try {
        result = await pgClient.query(fileData.toString());
    } finally {
        pgClient.release();
    }
    logger.debug(`queryDbFromFile: ${fileName}`);
    return result;
}

//
// Sessions
//

export function bindStore(session) {
    sessionStore = new (pgStore(session))({
        tableName: config.get('sessions.tableName'),
        pool: pgPool,
    });
}

export function getStore() {
    return sessionStore;
}

//
// Database maintenance
//

export async function checkDbUp() {
    try {
        let queryRes = await queryDbAsync('getNumberOfTables', []);
        logger.info(
            `Current number of tables in the database: ${queryRes.rows[0].count}`,
        );
        if (parseInt(queryRes.rows[0].count) < 5) {
            queryRes = await queryDbFromFile('./setup/schema.sql');
            logger.info(`New database created.`);
            return true;
        } else {
            return true;
        }
    } catch (err) {
        return false;
    }
}

async function removeOldestPositions() {
    try {
        await queryDbFromFile('./setup/cleanup.sql');
        logger.info(`Oldest locations deleted from the database.`);
    } catch (err) {
        logger.error(`Unable to delete oldest locations. ${err.message}`);
    }
}

export function startMaintenance() {
    removeOldestPositions();
    setInterval(removeOldestPositions, config.get('db.maintenanceInterval'));
}
