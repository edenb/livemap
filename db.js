"use strict";
const config = require('config');
const { Pool } = require('pg');
const pgStore = require('connect-pg-simple');
const dbcache = require('./dbcache');
const fs = require('fs');

var sessionStore;
var queryDef = [];
var databaseUp = false;

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
pgPool.on('error', function (err, client) {
    console.error('Unexpected error on idle client', err);
    process.exit(1);
});

//
// Database operations with predefined queries
//

function queryDb(key, sqlParams, callback) {
    var cachedQryOut = null;

    if (typeof queryDef[key].qstr !== 'undefined') {
        if (queryDef[key].cached) {
            // Try to get the result from cache
            cachedQryOut = dbcache.load(queryDef[key], sqlParams);
            if (cachedQryOut !== null && typeof callback === 'function') {
                // console.log('queryDb - cached: ' + key);
                callback(null, cachedQryOut.rows, cachedQryOut.result);
            }
        }

        if (cachedQryOut === null) {
            pgPool.connect(function (err, client, release) {
                if (err) {
                    console.error('Database connection error: ', err);
                    if (typeof callback === 'function') {
                        callback(err, [], null);
                    }
                } else {
                    client.query(queryDef[key].qstr, sqlParams || [], function (err, res) {
                        release();
                        if (err) {
                            console.error('Database query error(' + key + '): ', err);
                            if (typeof callback === 'function') {
                                callback(err, [], null);
                            }
                        } else {
                            dbcache.invalidate(queryDef[key]);
                            if (queryDef[key].cached) {
                                dbcache.save(queryDef[key], sqlParams, res.rows, res);
                            }
                            if (typeof callback === 'function') {
                                // console.log('queryDb - **** from DB ****: ' + key);
                                callback(null, res.rows, res);
                            }
                        }
                    });
                }
            });
        }
    } else {
        console.error('No query for key: ', key);
        if (typeof callback === 'function') {
            callback(null, null, null);
        }
    }
}

//
// Database operations with queries from file
//

function queryDbFromFile(fileName, callback) {
    fs.readFile(fileName, function (fileError, fileData) {
        if (fileError === null) {
            pgPool.connect(function (err, client, release) {
                if (err) {
                    console.error('Database connection error: ', err);
                    if (typeof callback === 'function') {
                        callback(err, [], null);
                    }
                } else {
                    client.query(fileData.toString(), function (err, res) {
                        release();
                        if (err) {
                            console.error('Database query error: ', err);
                            if (typeof callback === 'function') {
                                callback(err, [], null);
                            }
                        } else {
                            if (typeof callback === 'function') {
                                //console.log('queryDbFromFile: ' + fileName);
                                callback(null, res.rows, res);
                            }
                        }
                    });
                }
            });
        } else {
            console.error('Unable to open SQL file.', fileError);
        }
    });
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

function checkDbUp() {
    queryDb('getNumberOfTables', [], function (err, rows, result) {
        if (err === null && rows !== null) {
            console.log('Current number of tables in the database: ' + rows[0].count);
            if (rows[0].count === '0') {
                queryDbFromFile('./setup/schema.sql', function (err, rows, result) {
                    if (err === null) {
                        console.log('New database created.');
                        databaseUp = true;
                    } else {
                        console.error('Database creation failed.', err);
                        databaseUp = false;
                    }
                });
            } else {
                databaseUp = true;
            }
        } else {
            console.error('Database error retrieving the number of tables.', err);
            databaseUp = false;
        }
    });
    return databaseUp;
}

function removeOldestPositions() {
    queryDbFromFile('./setup/cleanup.sql', function (err, rows, result) {
        if (err === null) {
            console.log('Oldest locations deleted from the database.');
        } else {
            console.error('Database error deleting oldest locations.', err);
        }
    });
}

function startMaintenance() {
    removeOldestPositions();
    setInterval(removeOldestPositions, config.get('db.maintenanceInterval'));
}

module.exports.queryDb = queryDb;
module.exports.bindStore = bindStore;
module.exports.getStore = getStore;
module.exports.checkDbUp = checkDbUp;
module.exports.startMaintenance = startMaintenance;
