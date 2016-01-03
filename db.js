var config = require('config');
var pg = require('pg');
var pgStore = require('connect-pg-simple');
var dbcache = require('./dbcache');

// Get the PostgreSQL login details from the config.
// Form: postgres://<PGUSER>:<PGPASS>@<URL>/<PGDATABASE> (for Heroku add ?ssl=true when accessing from a remote server)
// To set environment variable:
//  set C_DB_URL=user:pass@abc.com/table (Windows)
//  export C_DB_URL=user:pass@abc.com/table (*nix)
var connectionString = config.get('db.url');
var sessionStore;
var queryDef = [];

queryDef.getAllUsers = {'qstr': 'SELECT * FROM users', 'readTables': ['users'], 'writeTables': [], 'cached': true};
queryDef.findUserById = {'qstr': 'SELECT * FROM users WHERE user_id = $1', 'readTables': ['users'], 'writeTables': [], 'cached': true};
queryDef.findUserByUsername = {'qstr': 'SELECT * FROM users WHERE username = $1', 'readTables': ['users'], 'writeTables': [], 'cached': true};
queryDef.changeDetailsByUsername = {'qstr': 'UPDATE users SET fullname = $2, email = $3 WHERE username = $1', 'readTables': [], 'writeTables': ['users'], 'cached': false};
queryDef.changeAPIkeyByUsername = {'qstr': 'UPDATE users SET api_key = $2 WHERE username = $1', 'readTables': [], 'writeTables': ['users'], 'cached': false};
queryDef.changePwdByUsername = {'qstr': 'UPDATE users SET password = $2 WHERE username = $1', 'readTables': [], 'writeTables': ['users'], 'cached': false};
queryDef.getAllDevices = {'qstr': 'SELECT * FROM devices', 'readTables': ['devices'], 'writeTables': [], 'cached': true};
queryDef.getAllowedDevices = {'qstr': 'SELECT devices.* FROM devices INNER JOIN shared_devices ON devices.device_id = shared_devices.device_id WHERE shared_devices.user_id = $1 UNION SELECT devices.* FROM devices INNER JOIN users ON devices.api_key = users.api_key WHERE users.user_id = $1', 'readTables': ['devices', 'shared_devices', 'users'], 'writeTables': [], 'cached': true};
queryDef.getLastPositions = {'qstr': 'SELECT locations.*, devices.alias FROM locations INNER JOIN devices ON locations.device_id = devices.device_id WHERE location_id IN (SELECT max(location_id) FROM locations WHERE device_id IN (SELECT device_id FROM shared_devices WHERE user_id = $1 UNION SELECT devices.device_id FROM devices INNER JOIN users ON devices.api_key = users.api_key WHERE users.user_id = $1) GROUP BY device_id)', 'readTables': ['locations', 'devices', 'shared_devices', 'users'], 'writeTables': [], 'cached': true};
queryDef.insertPosition = {'qstr': 'INSERT INTO locations(device_id, device_id_tag, loc_timestamp, loc_lat, loc_lon, loc_type, loc_attr, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, Now())', 'readTables': [], 'writeTables': ['locations'], 'cached': false};
queryDef.insertDevice = {'qstr': 'INSERT INTO devices(api_key, identifier, alias) VALUES ($1, $2, $3) RETURNING *', 'readTables': [], 'writeTables': ['devices'], 'cached': false};
queryDef.deleteDevices = {'qstr': 'DELETE FROM devices WHERE device_id = ANY($1::int[])', 'readTables': [], 'writeTables': ['devices'], 'cached': false};
queryDef.findSessionById = {'qstr': 'SELECT sess FROM sessions WHERE sid = $1', 'readTables': ['sessions'], 'writeTables': [], 'cached': false};

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
// Sessions
//

function bindStore(session) {
    sessionStore = new (pgStore(session))({tableName: config.get('sessions.tableName'), conString: connectionString, pg: pg});
}

function getStore() {
    return sessionStore;
}

//
// Database maintenance
//

function removeOldestPositions() {
    var sqlStmt, query;

    pg.connect(connectionString, function (err, client, done) {
        if (err) {
            console.error('Database error deleting oldest locations. ', err);
            done();
        } else {
            sqlStmt  = 'DELETE FROM locations ';
            sqlStmt += 'WHERE location_id IN ';
            sqlStmt += '(SELECT location_id FROM ( ';
            sqlStmt += '    SELECT loc1.location_id, loc1.device_id, loc1.created_at, COUNT(*) num ';
            sqlStmt += '    FROM locations loc1 JOIN locations loc2 ';
            sqlStmt += '        ON ((loc1.device_id = loc2.device_id) OR (loc1.device_id IS NULL AND loc2.device_id IS NULL)) AND loc1.created_at <= loc2.created_at ';
            sqlStmt += '    GROUP BY loc1.location_id, loc1.device_id, loc1.created_at ';
            sqlStmt += '    HAVING COUNT(*) > 100 ';
            sqlStmt += '    ORDER BY device_id, created_at ';
            sqlStmt += ') AS location_id);';
            query = client.query(sqlStmt);

            query.on('error', function (err) {
                console.error('Database error deleting oldest locations. ', err);
                done();
            });

            query.on('end', function (result) {
                done();
            });
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
module.exports.startMaintenance = startMaintenance;
