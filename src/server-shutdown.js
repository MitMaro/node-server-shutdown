'use strict';

const async = require('async');
const debug = require('debug')('server-shutdown');
const httpAdapter = require('./adapter/http');
const socketioAdapter = require('./adapter/socketio');

function noop() {
	// this function does nothing
}

class ServerShutdown {
	constructor() {
		this.sockets = new Set();
		this.servers = new Set();
		this.adapters = new Map();
		this.stopped = false;
		this._serverConnectionHandler = this._serverConnectionHandler.bind(this);
		this._socketRequestHandler = this._socketRequestHandler.bind(this);
		this._socketUpgradeHandler = this._socketUpgradeHandler.bind(this);
		this._destroySockets = this._destroySockets.bind(this);

		this.registerAdapter(ServerShutdown.Adapters.http, httpAdapter);
		this.registerAdapter(ServerShutdown.Adapters.socketio, socketioAdapter);
	}

	registerAdapter(name, adapter) {
		this.adapters.set(name, adapter);
	}

	registerServer(server, adapterName) {
		if (!adapterName) {
			/* eslint-disable no-param-reassign */
			adapterName = ServerShutdown.Adapters.http;
			/* eslint-enable no-param-reassign */
		}
		if (!this.adapters.has(adapterName)) {
			throw new Error(`The adapter, ${adapterName}, is not registered`);
		}
		debug('Added server');
		const adapter = this.adapters.get(adapterName);

		this.servers.add(server);
		server.serverShutdownAdapter = adapter;
		server.on('request', this._socketRequestHandler);
		server.on('upgrade', this._socketUpgradeHandler);
		server.on('connection', (s) => this._serverConnectionHandler(s, adapter));
		server.on('secureConnection', (s) => this._serverConnectionHandler(s, adapter));
	}

	shutdown(callback) {
		this._shutdown(false, callback);
	}

	forceShutdown(callback) {
		this._shutdown(true, callback);
	}

	_shutdown(force, callback) {
		debug('Starting shutdown');
		const tasks = [];

		for (const server of this.servers) {
			tasks.push((cb) => server.serverShutdownAdapter.close(server, cb));
		}
		tasks.push(async.ensureAsync((cb) => this._destroySockets(force, cb)));
		this.stopped = true;
		async.parallel(tasks, () => {
			debug('Shutdown complete');
			(callback || noop)();
		});
	}

	_serverConnectionHandler(socket, adapter) {
		debug('Starting connection');
		socket.serverShutdownIdle = true;
		socket.serverShutdownAdapter = adapter;
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
		socket.serverShutdownAdapter.socketClose(socket);
		this.sockets.delete(socket);
	}
}

ServerShutdown.Adapters = {
	http: 'http',
	socketio: 'socketio'
};

module.exports = ServerShutdown;
