"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = __importDefault(require("http"));
const node_cron_1 = __importDefault(require("node-cron"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = require("mongoose");
const app_1 = require("./app");
const database_1 = require("./config/database");
const cloudinary_1 = require("./config/cloudinary");
const firebase_1 = require("./config/firebase");
const ensureIndexes_1 = require("./config/ensureIndexes");
const moods_1 = require("./seeds/moods");
const socket_1 = require("./socket");
const presenceService_1 = require("./services/presenceService");
const capsuleService_1 = require("./services/capsuleService");
const models_1 = require("./models");
const PORT = process.env.PORT ?? 3000;
async function bootstrap() {
    // External service configuration
    (0, cloudinary_1.configureCloudinary)();
    (0, firebase_1.initFirebase)();
    // MongoDB
    await (0, database_1.connectDatabase)();
    await (0, ensureIndexes_1.ensureIndexes)();
    await (0, moods_1.seedMoods)();
    // Express app
    const app = (0, app_1.createApp)();
    const httpServer = http_1.default.createServer(app);
    // Socket.io (module-level singleton so route handlers can emit events)
    const io = (0, socket_1.initIO)(httpServer);
    // ── Socket.io authentication middleware ──────────────────────────────────
    // Clients must pass `auth: { token: "<JWT>" }` in the handshake options.
    // The middleware attaches `socket.data.userId` for use in event handlers.
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication token is required.'));
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return next(new Error('Server configuration error.'));
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, secret);
            socket.data.userId = payload.userId;
            next();
        }
        catch {
            next(new Error('Invalid or expired authentication token.'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id} (userId: ${socket.data.userId})`);
        // Join the socket to the user's personal room (used for direct delivery
        // of events like capsule_unlock and pending event drain).
        const userId = socket.data.userId;
        socket.join(userId);
        // Drain any pending events queued while the user was offline (Req 4.10, 7.4)
        (0, capsuleService_1.drainPendingEvents)(io, userId).catch((err) => {
            console.error('[socket] drainPendingEvents error:', err);
        });
        // Join the socket to a conversation room so it receives new_message events
        socket.on('join_conversation', (conversationId) => {
            socket.join(conversationId);
        });
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(conversationId);
        });
        // ── Delivery receipt ────────────────────────────────────────────────────
        // Client emits `message:delivered` when it receives a message.
        // Server updates `deliveredTo[]` and emits `message_delivered` to the
        // conversation room so the sender sees the delivery tick.
        // Requirements: 7.2, 7.3
        socket.on('message:delivered', async (data) => {
            try {
                const { messageId } = data;
                if (!messageId || !mongoose_1.Types.ObjectId.isValid(messageId))
                    return;
                const recipientId = socket.data.userId;
                const message = await models_1.Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: new mongoose_1.Types.ObjectId(recipientId) } }, { new: true });
                if (!message)
                    return;
                // Broadcast delivery receipt to the conversation room (includes sender)
                io.to(message.conversationId.toString()).emit('message_delivered', {
                    messageId,
                    recipientId,
                });
            }
            catch (err) {
                console.error('[socket] message:delivered error:', err);
            }
        });
        // ── Read receipt ────────────────────────────────────────────────────────
        // Client emits `message:read` when the user views a message.
        // Server updates `readBy[]` and forwards `message_read` to the
        // conversation room within 500ms (Requirement 7.3).
        // Requirements: 7.3
        socket.on('message:read', async (data) => {
            try {
                const { messageId } = data;
                if (!messageId || !mongoose_1.Types.ObjectId.isValid(messageId))
                    return;
                const readerId = socket.data.userId;
                const message = await models_1.Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: new mongoose_1.Types.ObjectId(readerId) } }, { new: true });
                if (!message)
                    return;
                // Forward read receipt to the conversation room (includes sender)
                io.to(message.conversationId.toString()).emit('message_read', {
                    messageId,
                    readerId,
                });
            }
            catch (err) {
                console.error('[socket] message:read error:', err);
            }
        });
        // ── Typing indicator ────────────────────────────────────────────────────
        // Client emits `typing` while composing a message.
        // Server broadcasts to the conversation room within 300ms (Requirement 7.5).
        // Requirements: 7.5
        socket.on('typing', (data) => {
            const { conversationId } = data;
            if (!conversationId)
                return;
            const userId = socket.data.userId;
            // Broadcast to all OTHER sockets in the room (excluding the sender)
            socket.to(conversationId).emit('typing', { conversationId, userId });
        });
        // ── Stopped-typing indicator ────────────────────────────────────────────
        // Client emits `stopped_typing` when the user stops composing.
        // Server broadcasts to the conversation room within 300ms (Requirement 7.6).
        // Requirements: 7.6
        socket.on('stopped_typing', (data) => {
            const { conversationId } = data;
            if (!conversationId)
                return;
            const userId = socket.data.userId;
            socket.to(conversationId).emit('stopped_typing', { conversationId, userId });
        });
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    // Capsule unlock scheduler — runs every 30 seconds (Requirement 4.6)
    // Queries for time-based locked capsules whose unlockAt <= now, updates
    // their status to "unlocked", and emits `capsule_unlock` via Socket.io
    // within 2 seconds. Offline recipients receive the event on reconnect.
    node_cron_1.default.schedule('*/30 * * * * *', () => {
        (0, capsuleService_1.runCapsuleUnlockScheduler)(io).catch((err) => {
            console.error('[CapsuleService] Cron job error:', err);
        });
    });
    // Presence level transition checker — runs every 30 seconds (Requirement 6.4)
    // Detects users whose activity level has changed since the last check and
    // emits `presence_update` to all relevant Socket.io rooms within 2 seconds.
    node_cron_1.default.schedule('*/30 * * * * *', () => {
        (0, presenceService_1.runPresenceLevelCheck)(io).catch((err) => {
            console.error('[PresenceService] Cron job error:', err);
        });
    });
    // Start listening
    httpServer.listen(PORT, () => {
        console.log(`Aura backend listening on port ${PORT}`);
    });
}
bootstrap().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map