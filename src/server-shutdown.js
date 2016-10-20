'use strict';

const async = require('async');
const debug = require('debug')('server-shutdown');

function noop() {
	// this function does nothing
}
class ServerShutdown {
	constructor() {
		this.sockets = new Set();
		this.servers = new Set();
		this.stopped = false;
		this._serverConnectionHandler = this._serverConnectionHandler.bind(this);
		this._socketRequestHandler = this._socketRequestHandler.bind(this);
		this._socketUpgradeHandler = this._socketUpgradeHandler.bind(this);
		this._destroySockets = this._destroySockets.bind(this);
	}

	registerServer(server) {
		debug('Added server');
		this.servers.add(server);
		server.on('request', this._socketRequestHandler);
		server.on('upgrade', this._socketUpgradeHandler);
		server.on('connection', this._serverConnectionHandler);
	}

	shutdown(callback = noop, force = false) {
		debug('Starting shutdown');
		const tasks = [];

		for (const server of this.servers) {
			tasks.push(server.close.bind(server));
		}
		tasks.push(async.ensureAsync((cb) => this._destroySockets(force, cb)));
		this.stopped = true;
		async.parallel(tasks, () => {
			debug('Shutdown complete');
			callback();
		});
	}

	_serverConnectionHandler(socket) {
		debug('Starting connection');
		socket.serverShutdownIdle = true;
		this.sockets.add(socket);
		socket.on('close', () => {
			debug('Connection ended');
			this.sockets.delete(socket);
		});
	}

	_socketRequestHandler(req, res) {
		debug('Starting request');
		req.socket.serverShutdownIdle = false;
		res.on('finish', () => {
			debug('Finishing request');
			req.socket.serverShutdownIdle = true;
			if (this.stopped) {
				this._destroySocket(req.socket);
			}
		});
	}

	_socketUpgradeHandler(req, socket) {
		debug('Starting upgrade');
		if (req.headers.upgrade.toLowerCase() !== 'websocket') {
			debug('Not a websocket upgrade, skipping');
			return;
		}
		const originalWrite = socket.write;

		socket.serverShutdownWebSocket = true;
		// overwrite the socket write function because there is not a start write event
		socket.write = (data, encoding, callback) => {
			socket.serverShutdownIdle = false;
			return originalWrite.call(socket, data, encoding, () => {
				socket.serverShutdownIdle = true;
				if (this.stopped) {
					this._destroySocket(req.socket);
				}
				(callback || noop)();
			});
		};
	}

	_destroySockets(force, callback) {
		debug('Destroying sockets');
		for (const socket of this.sockets) {
			if (force || socket.serverShutdownIdle) {
				this._destroySocket(socket);
			}
		}
		debug('Done destroying sockets');
		callback();
	}

	_destroySocket(socket) {
		debug('Destroying socket');
		// Some sockets use close (engine.io), Node.js uses destroy
		(socket.destroy || socket.close).call(socket);
		this.sockets.delete(socket);
	}
}

module.exports = ServerShutdown;
