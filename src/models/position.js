import { queryDbAsync } from '../database/db.js';

//
// Exported modules
//

export async function getLastPositions(userId) {
    return await queryDbAsync('getLastPositions', [userId]);
}

export async function insertPosition(position) {
    return await queryDbAsync('insertPosition', position);
}
