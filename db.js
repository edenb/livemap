"use strict";
var config = require('config');
var pg = require('pg');
var pgStore = require('connect-pg-simple');
var dbcache = require('./dbcache');
var fs = require('fs');

// Get the PostgreSQL login details from the config.
// Form: postgres://<PGUSER>:<PGPASS>@<URL>/<PGDATABASE> (for Heroku add ?ssl=true when accessing from a remote server)
// To set environment variable:
//  set C_DB_URL=user:pass@abc.com/table (Windows)
//  export C_DB_URL=user:pass@abc.com/table (*nix)
var connectionString = config.get('db.url');
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
queryDef.getLastPositions = {'qstr': 'SELECT locations.*, devices.alias FROM locations INNER JOIN devices ON locations.device_id = devices.device_id WHERE location_id IN (SELECT max(location_id) FROM locations WHERE device_id IN (SELECT device_id FROM shared_devices WHERE user_id = $1 UNION SELECT devices.device_id FROM devices INNER JOIN users ON devices.api_key = users.api_key WHERE users.user_id = $1) GROUP BY device_id)', 'readTables': ['locations', 'devices', 'shared_devices', 'users'], 'writeTables': [], 'cached': true};
queryDef.insertPosition = {'qstr': 'INSERT INTO locations(device_id, device_id_tag, loc_timestamp, loc_lat, loc_lon, loc_type, loc_attr, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, Now())', 'readTables': [], 'writeTables': ['locations'], 'cached': false};
queryDef.insertDevice = {'qstr': 'INSERT INTO devices(api_key, identifier, alias) VALUES ($1, $2, $3) RETURNING *', 'readTables': [], 'writeTables': ['devices'], 'cached': false};
queryDef.deleteDevices = {'qstr': 'DELETE FROM devices WHERE device_id = ANY($1::int[])', 'readTables': [], 'writeTables': ['devices'], 'cached': false};
queryDef.findSessionById = {'qstr': 'SELECT sess FROM sessions WHERE sid = $1', 'readTables': ['sessions'], 'writeTables': [], 'cached': false};
queryDef.getNumberOfTables = {'qstr': 'SELECT count(*) FROM information_schema.tables WHERE table_schema = \'public\'', 'readTables': [], 'writeTables': [], 'cached': false};

//
// Database operations with predefined queries
//

function queryDb(key, sqlParams, callback) {
    var query, rows = [], cachedQryOut = null;

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
            pg.connect(connectionString, function (err, client, done) {
                if (err) {
                    console.error('Database connection error: ', err);
                    if (typeof callback === 'function') {
                        callback(err, [], null);
                    }
                    done();
                } else {
                    query = client.query(queryDef[key].qstr, sqlParams || []);

                    query.on('error', function (err) {
                        console.error('Database query error(' + key + '): ', err);
                        done();
                    });

                    query.on('row', function (row) {
                        rows.push(row);
                    });

                    query.on('end', function (result) {
                        dbcache.invalidate(queryDef[key]);
                        if (queryDef[key].cached) {
                            dbcache.save(queryDef[key], sqlParams, rows, result);
                        }
                        if (typeof callback === 'function') {
                           // console.log('queryDb - **** from DB ****: ' + key);
                            callback(null, rows, result);
                        }
                        done();
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
    var query, rows = [];

    fs.readFile(fileName, function (fileError, fileData) {
        if (fileError === null) {
            pg.connect(connectionString, function (err, client, done) {
                if (err) {
                    console.error('Database connection error: ', err);
                    if (typeof callback === 'function') {
                        callback(err, [], null);
                    }
                    done();
                } else {
                    query = client.query(fileData.toString());

                    query.on('error', function (err) {
                        console.error('Database query error: ', err);
                        done();
                    });

                    query.on('row', function (row) {
                        rows.push(row);
                    });

                    query.on('end', function (result) {
                        if (typeof callback === 'function') {
                            //console.log('queryDbFromFile: ' + fileName);
                            callback(null, rows, result);
                        }
                        done();
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
    sessionStore = new(pgStore(session))({tableName: config.get('sessions.tableName'), conString: connectionString, pg: pg});
}

function getStore() {
    return sessionStore;
}

//
// Database maintenance
//

function createDbSchema() {
    queryDb('getNumberOfTables', [], function (err, rows, result) {
        if (err === null && rows !== null) {
            console.log('Current number of tables in the database: ' + rows[0].count);
            if (rows[0].count === '0') {
                queryDbFromFile('./setup/schema.sql', function (err, rows, result) {
                    if (err === null) {
                        console.log('New database created.');
                    } else {
                        console.error('Database creation failed.', err);
                    }
                });
            }
        } else {
            console.error('Database error retrieving the number of tables.', err);
        }
    });
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
    createDbSchema();
    removeOldestPositions();
    setInterval(removeOldestPositions, config.get('db.maintenanceInterval'));
}

module.exports.queryDb = queryDb;
module.exports.bindStore = bindStore;
module.exports.getStore = getStore;
module.exports.startMaintenance = startMaintenance;
