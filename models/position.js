"use strict";
const db = require('../database/db');

//
// Exported modules
//

async function getLastPositions(userId) {
    let queryRes = db.getEmptyQueryRes();
    try {
        queryRes = await db.queryDbAsync('getLastPositions', [userId]);
        return queryRes;
    } catch(err) {
        // On error return the initial (empty) array
        return queryRes;
    }
}

module.exports.getLastPositions = getLastPositions;
