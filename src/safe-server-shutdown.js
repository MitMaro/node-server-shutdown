'use strict';

const async = require('async');
const debug = require('debug')('safe-shutdown');

function noop() { } // eslint-disable-line no-empty-function

class SafeServerShutdown {
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

	shutdown(force, done) {
		debug('Starting shutdown');
		if (typeof force === 'function') {
			/* eslint-disable no-param-reassign */
			done = force;
			force = false;
			/* eslint-enable no-param-reassign */
		}
		const tasks = [];

		for (const server of this.servers) {
			tasks.push(server.close.bind(server));
		}
		tasks.push(async.ensureAsync((cb) => this._destroySockets(force, cb)));
		this.stopped = true;
		async.parallel(tasks, () => {
			debug('Shutdown complete');
			(done || noop)();
		});
	}

	_serverConnectionHandler(socket) {
		debug('Starting connection');
		socket.safeServerShutdownIdle = true;
		this.sockets.add(socket);
		socket.on('close', () => {
			debug('Connection ended');
			this.sockets.delete(socket);
		});
	}

	_socketRequestHandler(req, res) {
		debug('Starting request');
		req.socket.safeServerShutdownIdle = false;
		res.on('finish', () => {
			debug('Finishing request');
			req.socket.safeServerShutdownIdle = true;
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

		// overwrite the socket write function because there is not a start write event
		socket.write = (data, encoding, callback) => {
			socket.safeServerShutdownIdle = false;
			return originalWrite.call(socket, data, encoding, () => {
				socket.safeServerShutdownIdle = true;
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
			if (force || socket.safeServerShutdownIdle) {
				this._destroySocket(socket);
			}
		}
		debug('Done destroying sockets');
		callback();
	}

	_destroySocket(socket) {
		debug('Destroying socket');
		socket.destroy();
		this.sockets.delete(socket);
	}
}

module.exports = SafeServerShutdown;
