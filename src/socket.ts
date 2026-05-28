import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

/**
 * Module-level Socket.io singleton.
 *
 * Call `initIO(server)` once during bootstrap (in server.ts) before any
 * route handler tries to emit events.  All other modules call `getIO()` to
 * obtain the shared instance.
 */

let io: SocketIOServer | null = null;

/**
 * Initialise the Socket.io server and store it as a module-level singleton.
 * Must be called exactly once, before any route handler runs.
 */
export function initIO(httpServer: http.Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? '*',
      methods: ['GET', 'POST'],
    },
  });
  return io;
}

/**
 * Return the shared Socket.io instance.
 * Throws if `initIO` has not been called yet.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error(
      'Socket.io has not been initialised. Call initIO(httpServer) first.'
    );
  }
  return io;
}
