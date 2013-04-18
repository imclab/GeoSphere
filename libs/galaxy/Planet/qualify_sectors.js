/**
 * Boilerplate instantiation
 */
if (typeof module !== 'undefined') {
	var GALAXY = require('./../GALAXY');
	var Sector = require('./../Sector');
	var mongoose = require('mongoose');
	var _ = require('underscore');
	var util = require('util');
	var _DEBUG = false;
} else {
	if (!window.GALAXY) {
		window.GALAXY = {};
	}
	var GALAXY = window.GALAXY;
}

if (!GALAXY._prototypes) {
	GALAXY._prototypes = {};
}

if (!GALAXY._prototypes.Planet) {
	GALAXY._prototypes.Planet = {};
}

GALAXY._prototypes.Planet.qualify_sectors = function () {
	var max_depth = 0;
	if (_DEBUG) console.log('qualify sectors...')

	this.each_sector(function (sector) {
		if (_DEBUG) 	console.log('qualifying depth of %s', sector.name);
		sector.depth = sector.ancestors().length;
		max_depth = Math.max(sector.depth, max_depth);
	});

	this.each_sector(function (sector) {
		sector.desc_gens = max_depth - sector.depth;
	})
	if (_DEBUG) console.log('done qualifying sectors');
};