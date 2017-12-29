// Type definitions for server-shutdown 1.1.0
// Project: server-shutdown
// Definitions by: Tim Oram <https://github.com/MitMaro>

export = ServerShutdown;

declare class ServerShutdown {
	/** Creates an instance of ServerShutdown */
	constructor();

	/**
	 * Register a server adapter with the system. Name should be a string and adapter is an object that contains a
	 * `close(server, callback)` function that is responsible for closing the server and a `socketClose(socket)`
	 * function that is responsible for destroying the sockets the server creates.
	 * @param name The unique name of the adapter
	 * @param adapter The adapter instance
	 */
	registerAdapter(name: string, adapter: ServerShutdown.IAdapter): void;

	/**
	 * Registers a http server with the library.
	 * @param server The server instance
	 */
	registerServer(server: ServerShutdown.IServer): void;

	/**
	 * Registers a server with the library with an adapter name used to set the type of server being registered.
	 * @param server The server instance
	 */
	registerServer(server: ServerShutdown.IServer, adapterName: string): void;

	/**
	 * Shutdown all the registered servers.
	 * @param callback The callback called once all connections are disconnected and servers are closed.
	 */
	shutdown(callback?: () => void): void;

	/**
	 * Shutdown all the servers registered with all connections forcefully disconnected.
	 * @param callback
	 */
	forceShutdown(callback?: () => void): void;
}

declare namespace ServerShutdown {
	/** A set of adapter names. */
	export namespace Adapter {
		/** The adapter name for the http adapter. */
		 let http: 'http';
		 /** The adapter name for the Socket.io adapter. */
		let socketio: 'socketio';
	}

	/** A set of adapters. */
	export namespace adapters {
		/** The adapter for http servers compatible with Node's HTTP servers. */
		let http: IAdapter;
		/** The adapter for Socket.io servers */
		let socketid: IAdapter;
	}

	/** The interface for an adapter */
	export interface IAdapter {
		/**
		 * Function to be called to shutdown the server.
		 * @param server The server instance
		 * @param callback Called once the server is shutdown
		 */
		close(server: IServer, callback: () => void): void;

		/**
		 * Function to be called to close the socket
		 * @param socket The socket instance
		 */
		socketClose(socket: IServer): void
	}

	/** The expected interface for a server */
	export interface IServer {
		/**
		 * Adds the `listener` for `eventName`.
		 * @param eventName The name of the event
		 * @param listener The listener function
		 */
		on(eventName: 'request' | 'upgrade' | 'connection' | 'secureConnection' | string, listener: () => void): void;
	}
}
