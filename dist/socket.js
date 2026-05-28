"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initIO = void 0;
const socket_io_1 = require("socket.io");
/**
 * Module-level Socket.io singleton.
 *
 * Call `initIO(server)` once during bootstrap (in server.ts) before any
 * route handler tries to emit events.  All other modules call `getIO()` to
 * obtain the shared instance.
 */
let io = null;
/**
 * Initialise the Socket.io server and store it as a module-level singleton.
 * Must be called exactly once, before any route handler runs.
 */
function initIO(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN ?? '*',
            methods: ['GET', 'POST'],
        },
    });
    return io;
}
exports.initIO = initIO;
/**
 * Return the shared Socket.io instance.
 * Throws if `initIO` has not been called yet.
 */
function getIO() {
    if (!io) {
        throw new Error('Socket.io has not been initialised. Call initIO(httpServer) first.');
    }
    return io;
}
exports.getIO = getIO;
//# sourceMappingURL=socket.js.map