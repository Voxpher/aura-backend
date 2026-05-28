"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getThread = exports.createReply = void 0;
const mongoose_1 = require("mongoose");
const models_1 = require("../models");
const socket_1 = require("../socket");
const messageService_1 = require("./messageService");
// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Build a typed service error with an HTTP status code and error code.
 */
function makeError(message, statusCode, code) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
}
// ── Service functions ──────────────────────────────────────────────────────
/**
 * Create a reply within an Echo Thread.
 *
 * - Validates that the parent message exists (404 if not).
 * - Computes `depth = parent.depth + 1`.
 * - Rejects with 400 if `depth > 5` (Requirement 5.6).
 * - Persists the reply with `parentMessageId` and `depth` (Requirement 5.3).
 * - Emits `new_reply` to the conversation's Socket.io room within 500 ms
 *   (Requirement 5.8).
 *
 * Requirements: 5.3, 5.6, 5.8, 5.11
 */
async function createReply(input) {
    const { parentMessageId, senderId, content } = input;
    const moodId = input.moodId ?? 'neutral';
    // Validate parent message ID format
    if (!mongoose_1.Types.ObjectId.isValid(parentMessageId)) {
        throw makeError('Invalid parent message ID.', 400, 'INVALID_MESSAGE_ID');
    }
    // Fetch parent message — must exist
    const parent = await models_1.Message.findById(parentMessageId);
    if (!parent) {
        throw makeError('Parent message not found.', 404, 'MESSAGE_NOT_FOUND');
    }
    // Enforce max depth of 5 (Requirement 5.6)
    const depth = parent.depth + 1;
    if (depth > 5) {
        throw makeError('Maximum Echo Thread depth of 5 has been reached.', 400, 'MAX_DEPTH_EXCEEDED');
    }
    // Persist the reply (Requirement 5.3)
    const reply = await models_1.Message.create({
        conversationId: parent.conversationId,
        senderId: new mongoose_1.Types.ObjectId(senderId),
        content,
        moodId,
        parentMessageId: parent._id,
        depth,
    });
    // Emit new_reply to the conversation room within 500 ms (Requirement 5.8)
    try {
        const io = (0, socket_1.getIO)();
        const payload = (0, messageService_1.stripLockedCapsuleContent)(reply);
        io.to(parent.conversationId.toString()).emit('new_reply', {
            reply: payload,
            parentId: parentMessageId,
        });
    }
    catch {
        // Socket.io not yet initialised in test environments — log and continue
        console.warn('[echoThreadService] Socket.io not available; new_reply event not emitted.');
    }
    return (0, messageService_1.stripLockedCapsuleContent)(reply);
}
exports.createReply = createReply;
/**
 * Fetch the full Echo Thread for a root message and return it as a nested
 * tree structure up to depth 5.
 *
 * Strategy:
 *  1. Validate the root message exists.
 *  2. Collect all descendants by iteratively querying the
 *     `{ parentMessageId: 1 }` index level by level (BFS).
 *  3. Assemble the flat list into a nested tree.
 *
 * Requirements: 5.3, 5.6
 */
async function getThread(rootMessageId) {
    if (!mongoose_1.Types.ObjectId.isValid(rootMessageId)) {
        throw makeError('Invalid message ID.', 400, 'INVALID_MESSAGE_ID');
    }
    const root = await models_1.Message.findById(rootMessageId).lean();
    if (!root) {
        throw makeError('Message not found.', 404, 'MESSAGE_NOT_FOUND');
    }
    // BFS: collect all descendants using the parentMessageId index
    // We stop at depth 5 as per Requirement 5.6
    const allMessages = [root];
    let currentLevelIds = [
        root._id,
    ];
    while (currentLevelIds.length > 0) {
        const children = await models_1.Message.find({
            parentMessageId: { $in: currentLevelIds },
        }).lean();
        if (children.length === 0)
            break;
        // Filter to depth ≤ 5 (defensive — schema enforces this too)
        const validChildren = children.filter((c) => c.depth <= 5);
        allMessages.push(...validChildren);
        currentLevelIds = validChildren.map((c) => c._id);
    }
    // Build a map from id → ThreadNode for O(n) tree assembly
    const nodeMap = new Map();
    for (const msg of allMessages) {
        const id = msg._id.toString();
        nodeMap.set(id, {
            message: (0, messageService_1.stripLockedCapsuleContent)(msg),
            replies: [],
        });
    }
    // Wire up parent → child relationships
    for (const msg of allMessages) {
        const parentId = msg.parentMessageId?.toString();
        if (parentId && nodeMap.has(parentId)) {
            const childId = msg._id.toString();
            const childNode = nodeMap.get(childId);
            nodeMap.get(parentId).replies.push(childNode);
        }
    }
    // Return the root node
    const rootNode = nodeMap.get(root._id.toString());
    if (!rootNode) {
        throw makeError('Failed to build thread tree.', 500, 'INTERNAL_ERROR');
    }
    return rootNode;
}
exports.getThread = getThread;
//# sourceMappingURL=echoThreadService.js.map