'use strict';
const fs = require('fs');

function readDir(dirName) {
    return new Promise((resolve, reject) => {
        fs.readdir(dirName, (dirError, dirData) => {
            if (dirError === null) {
                resolve(dirData);
            } else {
                reject(dirError);
            }
        });
    });
}

function readFile(fileName) {
    return new Promise((resolve, reject) => {
        fs.readFile(fileName, 'utf8', (fileError, fileData) => {
            if (fileError === null) {
                resolve(fileData);
            } else {
                reject(fileError);
            }
        });
    });
}

//
// Exported modules
//

async function getStaticLayers() {
    let staticLayerList = [];
    try {
        let allFiles = await readDir('./staticlayers/');
        // Sort filenames in alphabatical order
        allFiles.sort((a, b) => {
            return a < b ? -1 : 1;
        });
        for (let fileName of allFiles) {
            let fileNameParts = fileName.split('.');
            let fileExt = fileNameParts[fileNameParts.length - 1];
            if (fileNameParts.length > 1 && fileExt == 'geojson') {
                let fileData = await readFile(`./staticlayers/${fileName}`);
                staticLayerList.push(JSON.parse(fileData));
            }
        }
        return staticLayerList;
    } catch (err) {
        return [];
    }
}

module.exports.getStaticLayers = getStaticLayers;
