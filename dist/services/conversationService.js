"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaveConversation = exports.addMember = exports.getUserConversations = exports.createConversation = void 0;
const mongoose_1 = require("mongoose");
const models_1 = require("../models");
const socket_1 = require("../socket");
// ── Helpers ────────────────────────────────────────────────────────────────
function toObjectId(id) {
    return new mongoose_1.Types.ObjectId(id);
}
// ── Service functions ──────────────────────────────────────────────────────
/**
 * Create a direct or group conversation.
 *
 * Direct: deduplicates — if a direct conversation between the two users already
 * exists, returns the existing record (201 is still appropriate for the caller
 * to decide; the route handler returns 200 for existing, 201 for new).
 *
 * Group: validates name (1–50 chars) and that at least 2 other members are
 * specified. Returns a descriptive 400 error on validation failure.
 *
 * Requirements: 8.2, 8.3, 8.8
 */
async function createConversation(input) {
    if (input.type === 'direct') {
        return createDirectConversation(input);
    }
    return createGroupConversation(input);
}
exports.createConversation = createConversation;
async function createDirectConversation(input) {
    const requesterOid = toObjectId(input.requesterId);
    const otherOid = toObjectId(input.otherUserId);
    // Deduplicate: find existing direct conversation between these two users
    const existing = await models_1.Conversation.findOne({
        type: 'direct',
        'members.userId': { $all: [requesterOid, otherOid] },
        $expr: { $eq: [{ $size: '$members' }, 2] },
    });
    if (existing) {
        return { conversation: existing, created: false };
    }
    const now = new Date();
    const conversation = await models_1.Conversation.create({
        type: 'direct',
        members: [
            { userId: requesterOid, role: 'member', joinedAt: now },
            { userId: otherOid, role: 'member', joinedAt: now },
        ],
    });
    return { conversation, created: true };
}
async function createGroupConversation(input) {
    // Validate group name (1–50 chars) — Requirement 8.3, 8.8
    const trimmedName = (input.name ?? '').trim();
    if (trimmedName.length < 1 || trimmedName.length > 50) {
        const err = {
            code: 'INVALID_GROUP_NAME',
            message: 'Group name must be between 1 and 50 characters.',
            status: 400,
        };
        throw err;
    }
    // Validate at least 2 other members — Requirement 8.3, 8.8
    const uniqueOtherIds = [
        ...new Set((input.memberIds ?? []).filter((id) => id !== input.requesterId)),
    ];
    if (uniqueOtherIds.length < 2) {
        const err = {
            code: 'INSUFFICIENT_MEMBERS',
            message: 'A group conversation requires at least 2 other members.',
            status: 400,
        };
        throw err;
    }
    const now = new Date();
    const requesterOid = toObjectId(input.requesterId);
    const members = [
        { userId: requesterOid, role: 'admin', joinedAt: now },
        ...uniqueOtherIds.map((id) => ({
            userId: toObjectId(id),
            role: 'member',
            joinedAt: now,
        })),
    ];
    const conversation = await models_1.Conversation.create({
        type: 'group',
        name: trimmedName,
        members,
    });
    return { conversation, created: true };
}
/**
 * Return all conversations for a user, sorted by lastMessageAt descending.
 * Conversations with no messages yet (lastMessageAt undefined) appear last.
 *
 * Requirements: 8.6
 */
async function getUserConversations(userId) {
    const userOid = toObjectId(userId);
    const conversations = await models_1.Conversation.find({
        'members.userId': userOid,
    }).sort({ lastMessageAt: -1 });
    return conversations;
}
exports.getUserConversations = getUserConversations;
/**
 * Add a member to a group conversation.
 * Only admins may perform this action (403 if not).
 * Emits `member_added` to the conversation Socket.io room within 500ms.
 *
 * Requirements: 8.4
 */
async function addMember(conversationId, requesterId, newMemberId) {
    const conversation = await models_1.Conversation.findById(conversationId);
    if (!conversation) {
        const err = {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found.',
            status: 404,
        };
        throw err;
    }
    // Requester must be a member
    const requesterMember = conversation.members.find((m) => m.userId.toString() === requesterId);
    if (!requesterMember) {
        const err = {
            code: 'NOT_A_MEMBER',
            message: 'You are not a member of this conversation.',
            status: 403,
        };
        throw err;
    }
    // Requester must be an admin — Requirement 8.4
    if (requesterMember.role !== 'admin') {
        const err = {
            code: 'FORBIDDEN',
            message: 'Only admins can add members to a group conversation.',
            status: 403,
        };
        throw err;
    }
    // Check if the new member is already in the conversation
    const alreadyMember = conversation.members.some((m) => m.userId.toString() === newMemberId);
    if (alreadyMember) {
        const err = {
            code: 'ALREADY_A_MEMBER',
            message: 'This user is already a member of the conversation.',
            status: 409,
        };
        throw err;
    }
    const newMemberEntry = {
        userId: toObjectId(newMemberId),
        role: 'member',
        joinedAt: new Date(),
    };
    conversation.members.push(newMemberEntry);
    await conversation.save();
    // Emit member_added to all existing members within 500ms — Requirement 8.4
    try {
        const io = (0, socket_1.getIO)();
        io.to(conversationId).emit('member_added', {
            conversationId,
            userId: newMemberId,
        });
    }
    catch {
        // Socket.io not yet initialised in test environments — non-fatal
    }
    return conversation;
}
exports.addMember = addMember;
/**
 * Remove the requesting user from a conversation (leave).
 *
 * If the leaving user is the last admin, the member with the earliest
 * `joinedAt` among remaining members is promoted to admin first.
 *
 * Requirements: 8.5
 */
async function leaveConversation(conversationId, userId) {
    const conversation = await models_1.Conversation.findById(conversationId);
    if (!conversation) {
        const err = {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found.',
            status: 404,
        };
        throw err;
    }
    const leavingMember = conversation.members.find((m) => m.userId.toString() === userId);
    if (!leavingMember) {
        const err = {
            code: 'NOT_A_MEMBER',
            message: 'You are not a member of this conversation.',
            status: 403,
        };
        throw err;
    }
    const remainingMembers = conversation.members.filter((m) => m.userId.toString() !== userId);
    // Last-admin promotion — Requirement 8.5
    if (leavingMember.role === 'admin') {
        const otherAdmins = remainingMembers.filter((m) => m.role === 'admin');
        if (otherAdmins.length === 0 && remainingMembers.length > 0) {
            // Promote the member with the earliest joinedAt
            const longestStanding = remainingMembers.reduce((earliest, m) => m.joinedAt < earliest.joinedAt ? m : earliest);
            longestStanding.role = 'admin';
        }
    }
    conversation.members = remainingMembers;
    await conversation.save();
    return conversation;
}
exports.leaveConversation = leaveConversation;
//# sourceMappingURL=conversationService.js.map