"use strict";
const config = require('config');
const { Pool } = require('pg');
const pgStore = require('connect-pg-simple');
const dbcache = require('./dbcache');
const fs = require('fs');
const logger = require('./logger.js');

var sessionStore;
var queryDef = [];

queryDef.getAllUsers = {'qstr': 'SELECT user_id, username, fullname, email, role, api_key FROM users', 'readTables': ['users'], 'writeTables': [], 'cached': true};
queryDef.findUserById = {'qstr': 'SELECT * FROM users WHERE user_id = $1', 'readTables': ['users'], 'writeTables': [], 'cached': true};
queryDef.findUserByUsername = {'qstr': 'SELECT * FROM users WHERE username = $1', 'readTables': ['users'], 'writeTables': [], 'cached': true};
queryDef.changeDetailsById = {'qstr': 'UPDATE users SET username = $2, fullname = $3, email = $4, role = $5, api_key = $6 WHERE user_id = $1', 'readTables': [], 'writeTables': ['users'], 'cached': false};
queryDef.changePwdByUsername = {'qstr': 'UPDATE users SET password = $2 WHERE username = $1', 'readTables': [], 'writeTables': ['users'], 'cached': false};
queryDef.insertUser = {'qstr': 'INSERT INTO users(username, fullname, email, role, api_key) VALUES ($1, $2, $3, $4, $5)', 'readTables': [], 'writeTables': ['users'], 'cached': false};
queryDef.deleteUser = {'qstr': 'DELETE FROM users WHERE user_id = $1', 'readTables': [], 'writeTables': ['users'], 'cached': false};
queryDef.getAllDevices = {'qstr': 'SELECT * FROM devices', 'readTables': ['devices'], 'writeTables': [], 'cached': true};
queryDef.getAllowedDevices = {'qstr': 'SELECT devices.* FROM devices INNER JOIN shared_devices ON devices.device_id = shared_devices.device_id WHERE shared_devices.user_id = $1 UNION SELECT devices.* FROM devices INNER JOIN users ON devices.api_key = users.api_key WHERE users.user_id = $1', 'readTables': ['devices', 'shared_devices', 'users'], 'writeTables': [], 'cached': true};
queryDef.findDevicesByUser = {'qstr': 'SELECT devices.*, array_agg(shared_users.username) AS shared FROM devices JOIN users ON devices.api_key = users.api_key LEFT JOIN shared_devices ON shared_devices.device_id = devices.device_id LEFT JOIN users AS shared_users ON shared_users.user_id = shared_devices.user_id WHERE users.user_id = $1 GROUP BY devices.device_id ORDER BY devices.device_id', 'readTables': ['devices', 'shared_devices', 'users'], 'writeTables': [], 'cached': true};
queryDef.changeDeviceById = {'qstr': 'UPDATE devices SET alias = $2, fixed_loc_lat = $3, fixed_loc_lon = $4 WHERE device_id = $1', 'readTables': [], 'writeTables': ['devices'], 'cached': false};
queryDef.insertDevice = {'qstr': 'INSERT INTO devices(api_key, identifier, alias) VALUES ($1, $2, $3) RETURNING *', 'readTables': [], 'writeTables': ['devices'], 'cached': false};
queryDef.deleteDevices = {'qstr': 'DELETE FROM devices WHERE device_id = ANY($1::int[])', 'readTables': [], 'writeTables': ['devices'], 'cached': false};
queryDef.addSharedUser = {'qstr': 'INSERT INTO shared_devices (device_id, user_id) SELECT d.device_id, u.user_id FROM devices d, users u WHERE u.username = $1 AND d.device_id = ANY($2::int[]) AND NOT EXISTS (SELECT * FROM shared_devices WHERE device_id = d.device_id AND user_id = u.user_id)', 'readTables': ['devices', 'users'], 'writeTables': ['shared_devices'], 'cached': false};
queryDef.deleteSharedUser = {'qstr': 'DELETE FROM shared_devices WHERE user_id = (SELECT user_id FROM users WHERE username = $1) AND device_id = ANY($2::int[])', 'readTables': ['users'], 'writeTables': ['shared_devices'], 'cached': false};
queryDef.getLastPositions = {'qstr': 'SELECT locations.*, devices.alias FROM locations INNER JOIN devices ON locations.device_id = devices.device_id WHERE location_id IN (SELECT max(location_id) FROM locations WHERE device_id IN (SELECT device_id FROM shared_devices WHERE user_id = $1 UNION SELECT devices.device_id FROM devices INNER JOIN users ON devices.api_key = users.api_key WHERE users.user_id = $1) GROUP BY device_id)', 'readTables': ['locations', 'devices', 'shared_devices', 'users'], 'writeTables': [], 'cached': true};
queryDef.insertPosition = {'qstr': 'INSERT INTO locations(device_id, device_id_tag, loc_timestamp, loc_lat, loc_lon, loc_type, loc_attr, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, Now())', 'readTables': [], 'writeTables': ['locations'], 'cached': false};
queryDef.findSessionById = {'qstr': 'SELECT sess FROM sessions WHERE sid = $1', 'readTables': ['sessions'], 'writeTables': [], 'cached': false};
queryDef.getNumberOfTables = {'qstr': 'SELECT count(*) FROM information_schema.tables WHERE table_schema = \'public\'', 'readTables': [], 'writeTables': [], 'cached': false};

function getEmptyQueryRes() {
    const emptyQueryRes = {
        rows: [],
        rowCount: 0
    };
    return emptyQueryRes;
}

// Initialize the pool
// Get the PostgreSQL login details from the config.
// Form: postgres://<PGUSER>:<PGPASS>@<URL>/<PGDATABASE> (for Heroku add ?ssl=true when accessing from a remote server)
// To set environment variable:
//  set DATABASE_URL=user:pass@abc.com/table (Windows)
//  export DATABASE_URL=user:pass@abc.com/table (*nix)
const pgPool = new Pool({
    connectionString: config.get('db.url'),
});

// The pool emits an error if a backend or network error occurs
// on any idle client. This is fatal so exit
pgPool.on('error', (err) => {
    logger.error(`Unexpected error on idle client. ${err.message}`);
    process.exit(1);
});

//
// Database operations with predefined queries
//

async function queryDbAsync(key, sqlParams) {
    let dbQueryRes = getEmptyQueryRes();

    if (typeof queryDef[key] !== 'undefined') {
        // Try to get the query result from cache
        if (queryDef[key].cached) {
            const cachedQueryRes = dbcache.load(queryDef[key], sqlParams);
            if (cachedQueryRes !== null) {
                logger.debug(`queryDb - cached: ${key}`);
                return cachedQueryRes.result;
            }
        }

        // Query the database
        const pgClient = await pgPool.connect();
        try {
            dbQueryRes = await pgClient.query({
                text: queryDef[key].qstr,
                values: sqlParams || []
            });
        } catch(err) {
            logger.error(`Database access failed. ${err}`);
            throw new Error(`Database access failed. ${err}`);
        } finally {
            pgClient.release();
        }

        // Update cache
        dbcache.invalidate(queryDef[key]);
        if (queryDef[key].cached) {
            dbcache.save(queryDef[key], sqlParams, dbQueryRes.rows, dbQueryRes);
        }
    } else {
        logger.error(`Database query failed. No query for key: ${key}`);
        throw new Error(`Database query failed. No query for key: ${key}`);
    }

    return dbQueryRes;
}

//
// Database operations with queries from file
//

function readQueryFromFile(fileName) {
    return new Promise ((resolve, reject) => {
        fs.readFile(fileName, (fileError, fileData) => {
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
        result = await pgClient.query({
            text: fileData.toString()
        });
    } finally {
        pgClient.release();
    }
    logger.debug(`queryDbFromFile: ${fileName}`);
    return result;
}

//
// Sessions
//

function bindStore(session) {
    sessionStore = new(pgStore(session))({tableName: config.get('sessions.tableName'), pool: pgPool});
}

function getStore() {
    return sessionStore;
}

//
// Database maintenance
//

async function checkDbUp() {
    try {
        let queryRes = await queryDbAsync('getNumberOfTables', []);
        logger.info(`Current number of tables in the database: ${queryRes.rows[0].count}`);
        if (queryRes.rows[0].count === '0') {
            queryRes = await queryDbFromFile('./setup/schema.sql');
            logger.info(`New database created.`);
        }
    } catch(err) {
        logger.error(`Unable to check database status. ${err}`);
        return false;
    }
    return true;
}

async function removeOldestPositions() {
    try {
        await queryDbFromFile('./setup/cleanup.sql');
        logger.info(`Oldest locations deleted from the database.`);
    } catch (err) {
        logger.error(`Unable to delete oldest locations. ${err.message}`);
    }
}

function startMaintenance() {
    removeOldestPositions();
    setInterval(removeOldestPositions, config.get('db.maintenanceInterval'));
}

module.exports.getEmptyQueryRes = getEmptyQueryRes;
module.exports.queryDbAsync = queryDbAsync;
module.exports.bindStore = bindStore;
module.exports.getStore = getStore;
module.exports.checkDbUp = checkDbUp;
module.exports.startMaintenance = startMaintenance;
