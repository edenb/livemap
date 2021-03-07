// Cache JSON structure
// qry: JSON object with query string (SELECT ... FROM ... WHERE...), affected tables (for read and write) and cache selector
// param: Array of parameter values for parameterized queries
// result: Result of the given query (= rows and metadata of the query)
// timestamp: Date and time the result was cached
var cache = [];

function getIndexOf(qry, param) {
    for (let i = 0; i < cache.length; i += 1) {
        if (
            cache[i].qry.qstr === qry.qstr &&
            JSON.stringify(cache[i].param) === JSON.stringify(param)
        ) {
            return i;
        }
    }
    return null;
}

function save(qry, param, result) {
    // Don't re-save the query if it's already cached
    let idx = getIndexOf(qry, param);
    if (idx === null) {
        // A query should contain at least 1 table otherwise it's not a valid select statement
        if (qry.readTables !== []) {
            let cacheItem = {};
            cacheItem.qry = qry;
            cacheItem.param = param;
            cacheItem.result = result;
            cacheItem.timestamp = null; // For future use
            cache.push(cacheItem);
        }
    }
}

function load(qry, param) {
    let idx = getIndexOf(qry, param);
    if (idx !== null) {
        return cache[idx].result;
    }
    return null;
}

function invalidate(qry) {
    for (let i = 0; i < qry.writeTables.length; i += 1) {
        let j = 0;
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
