import { getEmptyQueryRes, queryDbAsync } from '../database/db.js';

//
// Exported modules
//

export async function getLastPositions(userId) {
    let queryRes = getEmptyQueryRes();
    try {
        queryRes = await queryDbAsync('getLastPositions', [userId]);
        return queryRes;
    } catch (err) {
        // On error return the initial (empty) array
        return queryRes;
    }
}

export async function insertPosition(position) {
    let queryRes = getEmptyQueryRes();
    try {
        queryRes = await queryDbAsync('insertPosition', position);
        return queryRes;
    } catch (err) {
        // On error return the initial (empty) array
        return queryRes;
    }
}
