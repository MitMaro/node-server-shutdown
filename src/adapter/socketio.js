'use strict';

module.exports = {
	close(io, callback) {
		// server is attached when io.engine is set
		if (io.engine) {
			// close function does not have a callback
			io.close();
		}
		callback();
	},
	socketClose(socket) {
		socket.disconnect(true);
	}
};
