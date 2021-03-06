var _ = require('underscore');
var util = require('util');
var path = require('path');
var fs = require('fs');

var line_reader = require('./line_reader');
var assert = require('assert');
var humanize = require('humanize');

var _DEBUG = false;

var Gate = require('gate');

/* ------------ CLOSURE --------------- */

/** ********************
 * Purpose: A base class for climate modelling
 */

function Base(depth) {
    if (_.isObject(depth)) {
        this.planet = depth;
    } else {
        var GeoSphere = require('./../../index.js');
        this.planet = new GeoSphere.Planet(depth);
    }
}

Base.prototype = {

    median_planet_data: function () {
        var self = this;
        this.planet.vertices(function (vertex) {
            var items = vertex.data(self.data_key) || [];

            var groups = _.groupBy(items, _.identity);
            var value = _.reduce(groups,function (out, items, key) {
                if (!out || out.count < items.length) {
                    return {
                        key: parseInt(key),
                        count: items.length
                    }
                } else {
                    return out;
                }
            }, {count: 0, key: null}).key;
            if (_DEBUG)   console.log('vertex %s %s: items %s, value: %s',
                vertex.index, self.data_key, util.inspect(items.slice(0, 4)), value);

            vertex.data(self.data_key, value);
        });
    },

    load_table_data: function (callback, file) {
        if (!this.title_rows) this.title_rows = 1;
        if (!this.delimiter) this.delimiter = ',';

        if (!file) file = this.data_file;
        assert(fs.existsSync(file), 'data file exists: ' + file);

        var stream = line_reader(file);
        var self = this;
        var line = 0;
        var titles;

        stream.on('line', function (data) {
            if (self.title_rows && line < self.title_rows) {
                if (line == self.title_rows - 1) {
                    titles = data.split(self.delimiter);
                }
            } else {
                // @TODO: mismatch testing
                self.line(_.object(titles, data.split(self.delimiter)));
            }
            ++line;
        });

        stream.on('end', callback);
    },

    /**
     * sample a binary chunk of data into a field.
     * note, the data is saved as a buffer.
     *
     * @param file {string} a string to the data file
     * @param rows {int} the number of rows of binary chunks
     * @param columns {int} the number of cols of binary chunks
     * @param data_size the number of bytes per chunk
     *
     * @param callback {function} -- returned the metarecord containing the point location
     */
    data_to_points: function (file, rows, columns, data_size, callback) {

        console.log('file: %s, rows: %s, cols: %s, data size: %s',
            file, rows, columns, data_size
        );

        var self = this;

        // the number of samples per segment.

        var points = this.planet.vertices().map(function (vertex) {
            return {
                row: Math.min(Math.floor(rows * vertex.uv.y), rows - 1),
                col: Math.min(Math.floor(columns * vertex.uv.x), columns - 1),
                vertex: vertex
            };
        })

        var stat = fs.statSync(file);
        var col_size = columns * data_size;
        console.log('size / col_size: %s, col size: %s', stat.size / (col_size), col_size);

        console.log('file is %s', humanize.numberFormat(stat.size, 0));

        fs.open(file, 'r', function (err, handle) {

            var gate = Gate.create();

            var by_row = _.groupBy(points, 'row');

            _.each(by_row, function (points, row) {
                console.log('getting data for row %s', row);

                if (!points.length) return;
                var start = points[0].row * col_size;
                var buffer = new Buffer(col_size);

                console.log('starting data read at %s', humanize.numberFormat(start, 0));

                var l = gate.latch();
                fs.read(handle, buffer, 0, col_size, start, function (err, bytesRead, fullBuffer) {
                    console.log('bytes read: %s', bytesRead);
                    var data = [];

                    _.range(0, bytesRead, 2).forEach(function (i) {
                        data.push(fullBuffer.readInt16BE(i))
                    });
                    console.log(' ---------- row %s from %s data: %s ... %s',
                        points[0].row, start, data.slice(0, 6).join(','), data.slice(-6).join(','));

                    if (err) throw err;
                    if (bytesRead != col_size) throw new Error('bad read:' + bytesRead + '/' + col_size);

                    points.forEach(function (point) {
                        point.data = new Buffer(data_size);
                        var sub_start = point.col * data_size;
                        var sub_end = sub_start + data_size;
                        fullBuffer.copy(point.data, 0, sub_start, sub_end);
                        console.log('reading col %s: start: %s, end: %s, a: %s, b: %s'
                            , point.col, sub_start, sub_end, point.data.readInt16BE(0), point.data.readInt16BE(2));

                    });

                    l();
                });
            });

            gate.await(function () {

                fs.close(handle, function () {
                    callback(null, points);
                })

            })
        })


    },

    vertex_to_buffer: function () {
        throw new Error('must override vertex_to_buffer');
    },

    buffer_to_vertex: function (vertex, buffer) {
        throw new Error("must override buffer_to_vertex");
    },

    /**
     * reading data from a 2D file where data is stored row by row
     * with the same binary size per unit
     * into the planet's vertices.
     * @TODO: read data for multiple vertexes at once.
     *
     * @param file
     * @param planet
     * @param callback
     */
    import: function (file, callback) {
        var planet = this.planet;

        var buffer_size = this.buffer_size();
        var self = this;

        var gate = Gate.create();
        var opened = gate.latch();

        fs.open(file, 'r', function (err, handle) {
            planet.vertices(function (vertex) {
                var vertex_latch = gate.latch();
                fs.read(handle, new Buffer(buffer_size), 0, buffer_size, vertex.index * buffer_size,
                    function (err, bytes_read, read_buffer) {
                        self.buffer_to_vertex(vertex, read_buffer);
                        if (!(vertex.index % Math.pow(4 , planet.depth)))   console.log('imported data for vertex %s of depth %s', vertex.index, vertex.planet.depth);
                        vertex_latch();
                    });
            });

            fs.close(handle, function () {
                gate.await(function () {
                    callback(null, planet);
                })
            });

            opened();
        });
    },

    export: function (file, planet, callback) {
        var stream = fs.createWriteStream(file);

        if (!callback) {
            callback = planet;
            planet = this.planet;
        }
        var gate = Gate.create();

        var self = this;
        var write_buffer;
        planet.vertices(function (vertex) {
            if (!write_buffer){
                write_buffer = self.vertex_to_buffer(vertex);
            } else {
                write_buffer = Buffer.concat([write_buffer, self.vertex_to_buffer(vertex)]);
            }
            if (write_buffer.length > 1024){
                stream.write(write_buffer, gate.latch());
                write_buffer = null;
            }
        });

        stream.write(write_buffer, gate.latch());

        gate.await(function () {
            stream.close(function () {
                process.nextTick(function () {
                    callback(null, planet);
                })
            });
        });
    },

    buffer_size: function(){
        throw new Error('must override buffer size');
    },

    fix_missing_data: function(handler){
        var problem_verts = this.planet.vertices();
        do {
            problem_verts = _.compact(handler.call(this, problem_verts));
        } while (problem_verts.length);
    }

};

/* -------------- EXPORT --------------- */

module.exports = Base;