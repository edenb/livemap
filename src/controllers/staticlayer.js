import * as slayer from '../models/staticlayer.js';

export async function getStaticLayers(req, res) {
    const staticLayers = await slayer.getStaticLayers();
    res.status(200).send(staticLayers);
}
