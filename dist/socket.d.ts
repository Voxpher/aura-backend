/// <reference types="node" />
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
/**
 * Initialise the Socket.io server and store it as a module-level singleton.
 * Must be called exactly once, before any route handler runs.
 */
export declare function initIO(httpServer: http.Server): SocketIOServer;
/**
 * Return the shared Socket.io instance.
 * Throws if `initIO` has not been called yet.
 */
export declare function getIO(): SocketIOServer;
//# sourceMappingURL=socket.d.ts.map