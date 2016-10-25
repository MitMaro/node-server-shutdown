'use strict';

module.exports = {
	close(server, callback) {
		server.close(callback);
	},
	socketClose(socket) {
		socket.destroy();
	}
};
