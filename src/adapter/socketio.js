'use strict';

const debug = require('debug')('server-shutdown:adapter-socketio');

module.exports = {
	close(io, callback) {
		debug('Shutting down SocketIO server');
		// server is attached when io.engine is set
		if (io.engine) {
			// close function does not have a callback
			io.close();
		}
		debug('SocketIO server shutdown');
		callback();
	},
	socketClose(socket) {
		debug('Disconnecting SocketIO socket');
		socket.disconnect(true);
		debug('SocketIO socket disconnected');
	}
};
