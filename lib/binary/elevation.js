var _ = require('underscore');
var util = require('util');
var path = require('path');
var fs = require('fs');
var async = require('async');

var GeoSphere = require('./../../index.js');
var ELEVATION_ROOT = path.resolve(GeoSphere.CLIMATE_BINARY, 'elevation');
if (!fs.existsSync(ELEVATION_ROOT)) fs.mkdirSync(ELEVATION_ROOT);

var BINARY_FILE = path.resolve(ELEVATION_ROOT, 'depth_%s.bin');
var PREVIEW_FILE = path.resolve(ELEVATION_ROOT, 'depth_%s.png');
var VALIDATION_FILE = path.resolve(ELEVATION_ROOT, 'depth_%s.validation.png');
var WRITTEN_VALIDATION_MSG = ' ... written validation file for depth %s';
var WRITTEN_PREVIEW_MSG = ' ... written validation file for depth %s';

var DONE_DEPTH_MSG = ' ----------- DONE WITH DEPTH %s ---------------';

/* ------------ CLOSURE --------------- */

/** ********************
 * Purpose: save raw data into binary summary files.
 */

function write_elevation_data(min_depth, max_depth, width, height) {
    console.log('WRITING ELEVATION DATA');


    var script = [];
    _.range(min_depth, max_depth + 1).forEach(function (depth) {
        var binary_file = util.format(BINARY_FILE, depth);
        var preview_file = util.format(PREVIEW_FILE, depth);
        var validation_file = util.format(VALIDATION_FILE, depth);
        var elevation = new GeoSphere.climate.Elevation(depth);

        script = script.concat([
            function(callback){
                elevation.init(callback);
            },
            function (callback) {
                elevation.export(binary_file, callback);
            },
            function (callback) {
                elevation.draw(width, height, preview_file, function () {
                    console.log(WRITTEN_PREVIEW_MSG, preview_file);
                    callback();
                });
            },
            function (callback) {
                elevation = new GeoSphere.climate.Elevation(depth);
                elevation.import(binary_file, callback);
            },
            function(callback){
                elevation.init(callback);
            },
            function (callback) {
                elevation.draw(width, height, validation_file, function () {
                    console.log(WRITTEN_VALIDATION_MSG, validation_file);
                    process.nextTick(callback);
                });
            },
        ]);
    });

    async.series(script, function () {
        console.log("\n\n ----- DONE WRITING ELEVATION %s... %s ------\n\n", min_depth, max_depth);
    });
}

/* -------------- EXPORT --------------- */

module.exports = write_elevation_data;