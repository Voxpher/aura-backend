"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.drainPendingEvents = exports.handleConditionMet = exports.runCapsuleUnlockScheduler = void 0;
const mongoose_1 = require("mongoose");
const models_1 = require("../models");
const PendingEvent_1 = __importDefault(require("../models/PendingEvent"));
const Conversation_1 = __importDefault(require("../models/Conversation"));
const notificationService_1 = require("./notificationService");
// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Determine whether a user is currently connected to Socket.io.
 * We check by looking for any socket in the user's personal room (userId room).
 *
 * @param io     - The shared Socket.io server instance
 * @param userId - The user's MongoDB ObjectId string
 */
async function isUserOnline(io, userId) {
    const sockets = await io.in(userId).fetchSockets();
    return sockets.length > 0;
}
/**
 * Emit `capsule_unlock` to a recipient.
 *
 * If the recipient is online, emit directly to their personal room.
 * If offline, write the event to the `pendingEvents` collection so it can be
 * delivered on reconnect (Requirement 4.10).
 *
 * Also sends a push notification regardless of online status (Requirement 10.2).
 *
 * @param io          - The shared Socket.io server instance
 * @param recipientId - The recipient's MongoDB ObjectId string
 * @param payload     - The `capsule_unlock` event payload
 */
async function deliverUnlockEvent(io, recipientId, payload) {
    const online = await isUserOnline(io, recipientId);
    if (online) {
        // Deliver immediately to the user's personal room (Requirement 4.6, 4.9)
        io.to(recipientId).emit('capsule_unlock', payload);
    }
    else {
        // Queue for delivery on reconnect (Requirement 4.10)
        await PendingEvent_1.default.create({
            recipientId: new mongoose_1.Types.ObjectId(recipientId),
            eventType: 'capsule_unlock',
            payload,
        });
    }
    // Also emit to the conversation room so any other connected participants
    // (e.g. the sender) can react to the unlock
    io.to(payload.conversationId).emit('capsule_unlock', payload);
    // Push notification (Requirement 10.2)
    try {
        await (0, notificationService_1.sendCapsuleUnlockNotification)(recipientId, payload.messageId);
    }
    catch (err) {
        // Push notification failure must not block the unlock flow
        console.error('[CapsuleService] Push notification error:', err);
    }
}
// ── Scheduler ─────────────────────────────────────────────────────────────
/**
 * Capsule unlock scheduler — called by the cron job every 30 seconds.
 *
 * Queries for time-based capsule messages where `unlockAt <= now` and
 * `status === "locked"`, updates their status to `"unlocked"`, and emits
 * `capsule_unlock` via Socket.io within 2 seconds (Requirement 4.6).
 *
 * For offline recipients the event is written to `pendingEvents` and
 * delivered on reconnect (Requirement 4.10).
 *
 * Requirements: 4.6, 4.10
 *
 * @param io - The shared Socket.io server instance
 */
async function runCapsuleUnlockScheduler(io) {
    const now = new Date();
    // Find all locked time-based capsules whose unlock time has passed
    const messages = await models_1.Message.find({
        'capsule.unlockAt': { $lte: now },
        'capsule.status': 'locked',
        'capsule.type': 'time',
    }).lean();
    if (messages.length === 0)
        return;
    // Bulk-update all matched messages to "unlocked"
    const messageIds = messages.map((m) => m._id);
    await models_1.Message.updateMany({ _id: { $in: messageIds } }, { $set: { 'capsule.status': 'unlocked' } });
    // Emit unlock events for each message
    for (const msg of messages) {
        const messageId = msg._id.toString();
        const conversationId = msg.conversationId.toString();
        const payload = { messageId, conversationId };
        // Fetch the conversation to find the recipient(s)
        // In a direct conversation the recipient is the non-sender member;
        // in a group conversation all members except the sender receive the event.
        try {
            const conversation = await Conversation_1.default.findById(conversationId).lean();
            if (!conversation)
                continue;
            const senderId = msg.senderId.toString();
            const recipients = conversation.members
                .map((m) => m.userId.toString())
                .filter((uid) => uid !== senderId);
            for (const recipientId of recipients) {
                await deliverUnlockEvent(io, recipientId, payload);
            }
        }
        catch (err) {
            console.error(`[CapsuleService] Error processing unlock for message ${messageId}:`, err);
        }
    }
}
exports.runCapsuleUnlockScheduler = runCapsuleUnlockScheduler;
// ── Condition-met handler ──────────────────────────────────────────────────
/**
 * Handle a condition-met signal from the recipient.
 *
 * Validates that the caller is the recipient of the capsule message, updates
 * the capsule status to "unlocked", and emits `capsule_unlock` within 2
 * seconds (Requirement 4.9).
 *
 * Requirements: 4.8, 4.9, 4.10
 *
 * @param io        - The shared Socket.io server instance
 * @param messageId - The capsule message's MongoDB ObjectId string
 * @param callerId  - The authenticated user's MongoDB ObjectId string
 * @returns The updated message object
 * @throws An error with `statusCode` and `code` properties on validation failure
 */
async function handleConditionMet(io, messageId, callerId) {
    if (!mongoose_1.Types.ObjectId.isValid(messageId)) {
        const err = new Error('Invalid message ID.');
        err.statusCode = 400;
        err.code = 'INVALID_MESSAGE_ID';
        throw err;
    }
    const message = await models_1.Message.findById(messageId);
    if (!message) {
        const err = new Error('Message not found.');
        err.statusCode = 404;
        err.code = 'MESSAGE_NOT_FOUND';
        throw err;
    }
    // Validate the message is a condition-based capsule
    if (!message.capsule?.enabled || message.capsule.type !== 'condition') {
        const err = new Error('This message is not a condition-based capsule.');
        err.statusCode = 400;
        err.code = 'NOT_A_CONDITION_CAPSULE';
        throw err;
    }
    // Validate the capsule is still locked
    if (message.capsule.status === 'unlocked') {
        const err = new Error('This capsule has already been unlocked.');
        err.statusCode = 409;
        err.code = 'ALREADY_UNLOCKED';
        throw err;
    }
    // Validate the caller is a member of the conversation (and not the sender)
    const conversation = await Conversation_1.default.findById(message.conversationId);
    if (!conversation) {
        const err = new Error('Conversation not found.');
        err.statusCode = 404;
        err.code = 'CONVERSATION_NOT_FOUND';
        throw err;
    }
    const isMember = conversation.members.some((m) => m.userId.toString() === callerId);
    if (!isMember) {
        const err = new Error('You are not a member of this conversation.');
        err.statusCode = 403;
        err.code = 'NOT_A_MEMBER';
        throw err;
    }
    // Only the recipient (non-sender) may signal condition-met (Requirement 4.8)
    const senderId = message.senderId.toString();
    if (callerId === senderId) {
        const err = new Error('Only the recipient can signal that a condition has been met.');
        err.statusCode = 403;
        err.code = 'SENDER_CANNOT_UNLOCK';
        throw err;
    }
    // Update capsule status to "unlocked"
    message.capsule.status = 'unlocked';
    await message.save();
    const conversationId = message.conversationId.toString();
    const payload = {
        messageId: message._id.toString(),
        conversationId,
    };
    // Emit unlock event — deliver to the caller (recipient) and the sender
    // The caller is online (they just made an HTTP request), so emit directly.
    io.to(callerId).emit('capsule_unlock', payload);
    // Also deliver to the sender
    await deliverUnlockEvent(io, senderId, payload);
    // Emit to the conversation room for any other participants
    io.to(conversationId).emit('capsule_unlock', payload);
    return message.toObject();
}
exports.handleConditionMet = handleConditionMet;
// ── Pending event drain ────────────────────────────────────────────────────
/**
 * Drain and deliver all pending events for a user who has just connected.
 *
 * Fetches all `pendingEvents` for `recipientId` ordered by `createdAt`,
 * emits each event to the user's socket, then deletes the delivered records.
 *
 * Must complete within 5 seconds of reconnect (Requirement 7.4 / 4.10).
 *
 * Requirements: 4.10, 7.4
 *
 * @param io          - The shared Socket.io server instance
 * @param recipientId - The reconnecting user's MongoDB ObjectId string
 */
async function drainPendingEvents(io, recipientId) {
    const events = await PendingEvent_1.default.find({
        recipientId: new mongoose_1.Types.ObjectId(recipientId),
    })
        .sort({ createdAt: 1 })
        .lean();
    if (events.length === 0)
        return;
    for (const event of events) {
        io.to(recipientId).emit(event.eventType, event.payload);
    }
    // Delete all delivered pending events
    const deliveredIds = events.map((e) => e._id);
    await PendingEvent_1.default.deleteMany({ _id: { $in: deliveredIds } });
}
exports.drainPendingEvents = drainPendingEvents;
//# sourceMappingURL=capsuleService.js.map