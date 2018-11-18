'use strict';

const ServerShutdown = require('./server-shutdown');

const httpAdapter = require('./adapter/http');
const socketioAdapter = require('./adapter/socketio');

module.exports = {
	Adapters: {
		http: httpAdapter,
		socketio: socketioAdapter,
	},
	ServerShutdown,
};
