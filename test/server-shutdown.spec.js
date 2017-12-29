'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const expect = require('chai').expect;
const ServerShutdown = require('../src/');
const SocketIo = require('socket.io');
const SocketIoClient = require('socket.io-client');

// monkey patch http server so that we have server.listening in Node 4
if (typeof Object.getPrototypeOf(http.Server.prototype).listening === 'undefined') {
	console.log('WARN: http.Server.listening is not defined, pataching'); // eslint-disable-line no-console
	Object.defineProperty(http.Server.prototype, 'listening', {
		get() {
			return Boolean(this._handle);
		},
		configurable: true,
		enumerable: true,
	});
}

// monkey patch https server so that we have server.listening in Node 4
if (typeof Object.getPrototypeOf(https.Server.prototype).listening === 'undefined') {
	console.log('WARN: https.Server.listening is not defined, patching'); // eslint-disable-line no-console
	Object.defineProperty(https.Server.prototype, 'listening', {
		get() {
			return Boolean(this._handle);
		},
		configurable: true,
		enumerable: true,
	});
}

// eslint-disable-next-line no-process-env
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('ServerShutdown', function () {
	let clientDone = false;
	let shutdownDone = false;

	function checkDone(done) {
		if (clientDone && shutdownDone) {
			return done();
		}
		return undefined;
	}

	beforeEach(function () {
		clientDone = false;
		shutdownDone = false;
	});

	it('should error when registering server with unknown adapter', function () {
		const serverManager = new ServerShutdown();

		expect(() => serverManager.registerServer(null, 'invalid-adapter-name'))
			.to.throw(/The adapter, invalid-adapter-name, is not registered/);
	});

	describe('with http connection', function () {
		let server;
		let serverManager;
		let port;

		beforeEach(function () {
			serverManager = new ServerShutdown();
			server = http.createServer();
			serverManager.registerServer(server);
			server.listen(0, () => {
				port = server.address().port;
			});
		});

		it('should shutdown with no active connections', function (done) {
			setImmediate(serverManager.shutdown.bind(serverManager, () => {
				expect(server.listening).to.be.false;
				done();
			}));
		});

		it('should shutdown with active HTTP connection', function (done) {
			function createRequest() {
				const client = http.request({
					port,
					headers: {Connection: 'keep-alive'},
				}, (res) => {
					expect(res.statusCode).to.equal(200);
					clientDone = true;
					checkDone(done);
				});

				client.end();
			}

			function acceptRequest(req, res) {
				// shutdown now
				serverManager.shutdown();
				// end response later
				setImmediate(() => {
					res.writeHead(200);
					res.end();
				});
			}

			server.on('listening', createRequest);
			server.once('request', acceptRequest);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should shutdown with inactive HTTP connection', function (done) {
			function createRequest() {
				const client = http.request({
					port,
					headers: {Connection: 'keep-alive'},
				}, function (res) {
					expect(res.statusCode).to.equal(200);
					clientDone = true;
					checkDone(done);
				});

				client.end();
			}

			function acceptRequest(req, res) {
				// end response now
				res.writeHead(200);
				res.end();
				// shutdown later
				setImmediate(serverManager.shutdown.bind(serverManager));
			}

			server.on('listening', createRequest);
			server.once('request', acceptRequest);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should shutdown with inactive websocket connection', function (done) {
			function createRequest() {
				const client = http.request({
					port,
					headers: {
						Connection: 'Upgrade,keep-alive',
						Upgrade: 'websocket',
					},
				});

				client.end();
				client.on('upgrade', function (res) {
					expect(res.statusCode).to.equal(101);
					expect(server.listening).to.be.false;
					clientDone = true;
					checkDone(done);
				});
			}

			function acceptUpgrade(req, socket) {
				// write now
				socket.write([
					'HTTP/1.1 101 Web Socket Protocol Handshake',
					'Upgrade: websocket',
					'Connection: Upgrade',
					'',
					'',
				].join('\r\n'));
				// stop server later
				setImmediate(serverManager.shutdown.bind(serverManager));
			}

			server.on('listening', createRequest);
			server.once('upgrade', acceptUpgrade);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should shutdown with active websocket connection', function (done) {
			function createRequest() {
				const client = http.request({
					port,
					headers: {
						Connection: 'Upgrade,keep-alive',
						Upgrade: 'websocket',
					},
				});

				client.end();
				client.on('upgrade', function (res) {
					expect(res.statusCode).to.equal(101);
					expect(server.listening).to.be.false;
					clientDone = true;
					checkDone(done);
				});
			}

			function acceptUpgrade(req, socket) {
				// pause buffer, and write some data
				socket.pause();
				socket.write([
					'HTTP/1.1 101 Web Socket Protocol Handshake',
					'Upgrade: websocket',
					'Connection: Upgrade',
					'',
					'',
				].join('\r\n'));
				// shutdown things
				serverManager.shutdown();
				// unpause later
				setImmediate(() => {
					socket.resume();
				});
			}

			server.on('listening', createRequest);
			server.once('upgrade', acceptUpgrade);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should pass on non-websocket connections', function (done) {
			function createRequest() {
				const client = http.request({
					port,
					headers: {
						Connection: 'Upgrade,keep-alive',
						Upgrade: 'not-websocket',
					},
				});

				client.end();
			}

			function acceptUpgrade() {
				expect(serverManager.sockets.size).to.equal(1);
				expect(serverManager.sockets.values().next().value).to.not.have.property('serverShutdownWebSocket');
				setImmediate(serverManager.shutdown.bind(serverManager));
				clientDone = true;
				checkDone(done);
			}

			server.on('listening', createRequest);
			server.once('upgrade', acceptUpgrade);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should force shutdown with active connections', function (done) {
			function createRequest() {
				const client = http.request({
					port,
					headers: {Connection: 'keep-alive'},
				}, function () {
					done.fail();
				});

				client.end();
			}

			function acceptRequest() {
				// we do not respond to the client, and force a shutdown
				setImmediate(serverManager.forceShutdown.bind(serverManager));
			}

			server.on('listening', createRequest);
			server.once('request', acceptRequest);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				done();
			});
		});
	});

	describe('with https connection', function () {
		let server;
		let serverManager;
		let port;

		beforeEach(function () {
			serverManager = new ServerShutdown();
			/* eslint-disable no-sync */
			server = https.createServer({
				key: fs.readFileSync('test/ssl/key.pem'),
				cert: fs.readFileSync('test/ssl/cert.pem'),
			});
			/* eslint-enable no-sync */
			serverManager.registerServer(server);
			server.listen(0, () => {
				port = server.address().port;
			});
		});

		it('should shutdown with no active connections', function (done) {
			setImmediate(serverManager.shutdown.bind(serverManager, () => {
				expect(server.listening).to.be.false;
				done();
			}));
		});

		it('should shutdown with inactive HTTPS connection', function (done) {
			function createRequest() {
				const client = https.request({
					port,
					headers: {Connection: 'keep-alive'},
				}, function (res) {
					expect(res.statusCode).to.equal(200);
					clientDone = true;
					checkDone(done);
				});

				client.end();
			}

			function acceptRequest(req, res) {
				// end response now
				res.writeHead(200);
				res.end();
				// shutdown later
				setImmediate(serverManager.shutdown.bind(serverManager));
			}

			server.on('listening', createRequest);
			server.once('request', acceptRequest);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should shutdown with inactive websocket connection', function (done) {
			function createRequest() {
				const client = https.request({
					port,
					headers: {
						Connection: 'Upgrade,keep-alive',
						Upgrade: 'websocket',
					},
				});

				client.end();
				client.on('upgrade', function (res) {
					expect(res.statusCode).to.equal(101);
					expect(server.listening).to.be.false;
					clientDone = true;
					checkDone(done);
				});
			}

			function acceptUpgrade(req, socket) {
				// write now
				socket.write([
					'HTTP/1.1 101 Web Socket Protocol Handshake',
					'Upgrade: websocket',
					'Connection: Upgrade',
					'',
					'',
				].join('\r\n'));
				// stop server later
				setImmediate(serverManager.shutdown.bind(serverManager));
			}

			server.on('listening', createRequest);
			server.once('upgrade', acceptUpgrade);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should shutdown with active websocket connection', function (done) {
			function createRequest() {
				const client = https.request({
					port,
					headers: {
						Connection: 'Upgrade,keep-alive',
						Upgrade: 'websocket',
					},
				});

				client.end();
				client.on('upgrade', function (res) {
					expect(res.statusCode).to.equal(101);
					expect(server.listening).to.be.false;
					clientDone = true;
					checkDone(done);
				});
			}

			function acceptUpgrade(req, socket) {
				// pause buffer, and write some data
				socket.pause();
				socket.write([
					'HTTP/1.1 101 Web Socket Protocol Handshake',
					'Upgrade: websocket',
					'Connection: Upgrade',
					'',
					'',
				].join('\r\n'));
				// shutdown things
				serverManager.shutdown();
				// unpause later
				setImmediate(() => {
					socket.resume();
				});
			}

			server.on('listening', createRequest);
			server.once('upgrade', acceptUpgrade);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should pass on non-websocket connections', function (done) {
			function createRequest() {
				const client = https.request({
					port,
					headers: {
						Connection: 'Upgrade,keep-alive',
						Upgrade: 'not-websocket',
					},
				});

				client.end();
			}

			function acceptUpgrade() {
				expect(serverManager.sockets.size).to.equal(2);
				expect(serverManager.sockets.values().next().value).to.not.have.property('serverShutdownWebSocket');
				setImmediate(serverManager.shutdown.bind(serverManager));
				clientDone = true;
				checkDone(done);
			}

			server.on('listening', createRequest);
			server.once('upgrade', acceptUpgrade);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				shutdownDone = true;
				checkDone(done);
			});
		});

		it('should force shutdown with active connections', function (done) {
			function createRequest() {
				const client = https.request({
					port,
					headers: {Connection: 'keep-alive'},
				}, function () {
					done.fail();
				});

				client.end();
			}

			function acceptRequest() {
				// we do not respond to the client, and force a shutdown
				setImmediate(serverManager.forceShutdown.bind(serverManager, true));
			}

			server.on('listening', createRequest);
			server.once('request', acceptRequest);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				expect(server.listening).to.be.false;
				done();
			});
		});
	});

	describe('with socketio adapter', function () {
		let serverManager;

		beforeEach(function () {
			serverManager = new ServerShutdown();
		});

		it('should shutdown with a socketio server registered', function (done) {
			serverManager.registerServer(new SocketIo(http.createServer()), ServerShutdown.Adapters.socketio);
			setImmediate(serverManager.shutdown.bind(serverManager, () => {
				// no real test that can be performed here, if socketio server does not shutdown
				// this will timeout
				done();
			}));
		});

		it('should ignore a unattached socketio server', function (done) {
			serverManager.registerServer(new SocketIo(), ServerShutdown.Adapters.socketio);
			setImmediate(serverManager.shutdown.bind(serverManager, () => {
				// no real test that can be performed here, if socketio server does not shutdown
				// this will timeout
				done();
			}));
		});

		it('should shutdown with active websocket connection', function (done) {
			const server = http.createServer();
			const io = new SocketIo(server, {
				serveClient: false,
				transports: ['websocket'],
			});

			serverManager.registerServer(server);
			serverManager.registerServer(io, ServerShutdown.Adapters.socketio);

			function createRequest() {
				const socket = new SocketIoClient(
					`http://localhost:${server.address().port}`, {
						transports: ['websocket'],
						reconnection: false,
					}
				);

				socket.on('connect', () => setImmediate(serverManager.shutdown.bind(serverManager)));
			}
			server.listen(0);
			server.on('listening', createRequest);
			server.once('close', (err) => {
				expect(err).to.not.exist;
				shutdownDone = true;
				done();
			});
		});
	});
});
