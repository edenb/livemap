// Cache JSON structure
// qry: JSON object with query string (SELECT ... FROM ... WHERE...), affected tables (for read and write) and cache selector
// param: Array of parameter values for parameterized queries
// rows: Returned rows of the given query
// result: Result of the given query (= metadata of the query)
// timestamp: Date and time the result was cached
var cache = [];

function getIndexOf(qry, param) {
    for (let i = 0; i < cache.length; i += 1) {
        if ((cache[i].qry.qstr === qry.qstr) && (JSON.stringify(cache[i].param) === JSON.stringify(param))) {
            return i;
        }
    }
    return null;
}

function save(qry, param, rows, result) {
    var idx, cacheItem = {};

    // Don't re-save the query if it's already cached
    idx = getIndexOf(qry, param);
    if (idx === null) {
        // A query should contain at least 1 table otherwise it's not a valid select statement
        if (qry.readTables !== []) {
            cacheItem.qry = qry;
            cacheItem.param = param;
            cacheItem.rows = rows;
            cacheItem.result = result;
            cacheItem.timestamp = null;  // For future use
            cache.push(cacheItem);
        }
    }
}

function load(qry, param) {
    var idx, qryOut = {};

    idx = getIndexOf(qry, param);
    if (idx !== null) {
        qryOut.rows = cache[idx].rows;
        qryOut.result = cache[idx].result;
    } else {
        qryOut = null;
    }
    return qryOut;
}

function invalidate(qry) {
    var i, j = 0;

    for (i = 0; i < qry.writeTables.length; i += 1) {
        while (j < cache.length) {
            if (cache[j].qry.readTables.indexOf(qry.writeTables[i]) > -1) {
                cache.splice(j, 1);
            } else {
                j += 1;
            }
        }
    }
}

function clearAll() {
    cache = [];
}

module.exports.save = save;
module.exports.load = load;
module.exports.invalidate = invalidate;
module.exports.clearAll = clearAll;
