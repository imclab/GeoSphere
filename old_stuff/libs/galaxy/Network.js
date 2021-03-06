/**
 * Boilerplate construction
 */

if (typeof module !== 'undefined') {
	var GALAXY = require('./GALAXY');
	require('./Network/index');
	require('./util/index');
} else {
	if (!window.GALAXY) window.GALAXY = {};
	var GALAXY = window.GALAXY;
}

/**
 * Class Definition
 */

GALAXY.Network = (function () {

	function Network(planet, detail, no_init) {
		this.planet = planet;
		this.nodes = {};
		this.node_list = [];
		this.detail = detail;
		if (!no_init) {
			this.init();
		}
	}

	Network.prototype = GALAXY._prototypes.Network;
	return Network;
})();

if (typeof module !== 'undefined') {
	module.exports = GALAXY.Network;
}