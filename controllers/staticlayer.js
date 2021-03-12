'use strict';
const slayer = require('../models/staticlayer');

exports.getStaticLayers = async (req, res) => {
    const staticLayers = await slayer.getStaticLayers();
    res.status(200).send(staticLayers);
};
