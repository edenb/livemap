import * as pos from '../models/position.js';

export async function getLastPositions(req, res) {
    const { rows } = await pos.getLastPositions(req.tokenPayload.userId);
    res.status(200).send(rows);
}
