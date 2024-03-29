import * as pos from '../models/position.js';

export async function getLastPositions(req, res) {
    const queryRes = await pos.getLastPositions(req.tokenPayload.userId);
    if (typeof queryRes.userMessage !== 'undefined') {
        res.status(500).send(`Internal Server Error`);
    } else {
        res.status(200).send(queryRes.rows);
    }
}
