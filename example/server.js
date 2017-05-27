'use strict';

const cors = require('cors');
const ecstatic = require('ecstatic');
const feathers = require('feathers');
const featherssocketio = require('feathers-socketio');
const http = require('http');
const rest = require('feathers-rest');
const socketio = require('socket.io');

const ServerShutdown = require('../src/');
const serverShutdown = new ServerShutdown();

// feathers socket.io
const app = feathers();

app.configure(featherssocketio({ path: '/feathers.io' }, (io) => {
	serverShutdown.registerServer(io, ServerShutdown.Adapters.socketio);

	io.on('connection', (socket) => {
		console.log(`Feathers client connected`);
		socket.emit('connected', {});
	});
}));

app.use(cors());
// http
app.configure(rest());

app.use('/service', {
	get(id) {
		console.log(`service::get ${id}`);
		return Promise.resolve({ id });
	}
});

const server = app.listen(3000);

serverShutdown.registerServer(server);

// socket.io
const io = socketio(server, {
	serveClient: false, path: '/socket.io'
});

serverShutdown.registerServer(io);

io.on('connection', (socket) => {
	socket.on('service::get', (data) => {
		console.log('service::get ', data.id);
		socket.emit('service::get::response', data);
	});
});


const staticServer = http.createServer(
	ecstatic({ root: __dirname })
).listen(8080);

serverShutdown.registerServer(staticServer);
console.log('Static server started on : http://localhost:8080');


let sigint = false;

process.on('SIGINT', () => {
	if (sigint) {
		process.exit(1);
	}
	sigint = true;
	console.log();
	console.log('Shutting down server; ctrl-c to force');
	serverShutdown.shutdown(() => {
		console.log('Server shutdown complete');
	});
});
