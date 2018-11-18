# Server Shutdown

[![Known Vulnerabilities](https://snyk.io/test/github/mitmaro/node-server-shutdown/badge.svg)](https://snyk.io/test/github/mitmaro/node-server-shutdown)
[![Build Status](https://travis-ci.org/MitMaro/node-server-shutdown.svg?branch=master)](https://travis-ci.org/MitMaro/node-server-shutdown)
[![Coverage Status](https://coveralls.io/repos/github/MitMaro/node-server-shutdown/badge.svg?branch=master)](https://coveralls.io/github/MitMaro/node-server-shutdown?branch=master)
[![NPM version](https://img.shields.io/npm/v/server-shutdown.svg)](https://www.npmjs.com/package/server-shutdown)
[![GitHub license](https://img.shields.io/badge/license-ISC-blue.svg)](https://raw.githubusercontent.com/MitMaro/node-server-shutdown/master/LICENSE.md)

Using just [`server.close`][1] only terminates the server once every connection is closed. This is problematic since,
[by design][2], keep-alive connections can continue to hold the server open, and WebSockets can hold the connection open
for extended periods of time. A [naive solution][3] forcefully destroys all the sockets, interrupting any in-flight
requests. Another solution is to [`server.unref`][4] the server, but this isn't a satisfactory solution as it does not
allow the [`close`][5] event to be used.

This library solves this problem by tracking when a connection is busy, using [`request`][6] for HTTP connections, and
hooking into [`write`][7] in the case of WebSockets. The server shutdowns by first stopping any additional connections
being made, closing any idle HTTP and WebSocket connections, closing any busy HTTP connections once the in-flight
request has completed, and closing WebSocket connections on the finish of a write. 

## Install

    npm install --save server-shutdown

## Documentation

* [Example][9]
* [API Documentation][10]

### Usage

```javascript
const http = require('http');
const https = require('https');
const {ServerShutdown} = require('server-shutdown');
const serverShutdown = new ServerShutdown();

const httpServer = http.createServer((req, res) => {
    res.end('HTTP response');
}).listen(80);

const httpsServer = https.createServer((req, res) => {
    res.end('HTTPS response');
}).listen(443);

serverShutdown.registerServer(httpServer);
serverShutdown.registerServer(httpsServer);

process.on('SIGTERM', () => {
    serverShutdown.shutdown(() => {
        console.log('All servers shutdown gracefully');
    });
});
```

#### Adding Socket.io

```javascript
// continuing from basic usage
const socketio = require('socket.io');
const io = socketio(httpServer);
serverShutdown.registerServer(io, ServerShutdown.Adapter.socketio);
```

## Debugging

This library uses [debug][8] to produce debugging output. To enable add `DEBUG=server-shutdown` before
your run command.

## Development

Development is done using Node 8 and NPM 5, and tested against Node 6 through 10. To get started

* Install Node 8 from [NodeJS.org][node] or using [nvm]
* Clone the repository using `git clone git@github.com:MitMaro/node-server-shutdown.git`
* `cd node-server-shutdown`
* Install the dependencies `npm install`
* Make changes, add tests, etc.
* Run linting and test suite using `npm run test`
* Build using `npm run build`

## License

This project is released under the ISC license. See [LICENSE](LICENSE.md).


[1]: https://nodejs.org/api/http.html#http_server_close_callback
[2]: https://github.com/nodejs/node/issues/2642
[3]: https://github.com/isaacs/server-destroy
[4]: https://nodejs.org/api/net.html#net_server_unref
[5]: https://nodejs.org/api/http.html#http_event_close
[6]: https://nodejs.org/api/http.html#http_event_request
[7]: https://nodejs.org/api/http.html#http_response_write_chunk_encoding_callback
[8]: https://github.com/visionmedia/debug
[9]: example/README.md
[10]: http://www.mitmaro.ca/node-server-shutdown/
