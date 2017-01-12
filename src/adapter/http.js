'use strict';

const debug = require('debug')('server-shutdown:adapter-http');

module.exports = {
	close(server, callback) {
		debug('Shutting down HTTP server');
		server.close(() => {
			debug('HTTP server shutdown');
			callback();
		});
	},
	socketClose(socket) {
		debug('Ending HTTP socket');
		socket.destroy();
		debug('HTTP socket ended');
	}
};
