"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const models_1 = require("../models");
const User_1 = __importDefault(require("../models/User"));
const conversationService_1 = require("../services/conversationService");
const router = (0, express_1.Router)();
// ── Validation schemas ─────────────────────────────────────────────────────
const CreateConversationSchema = zod_1.z.union([
    zod_1.z.object({
        type: zod_1.z.literal('direct'),
        memberIds: zod_1.z.array(zod_1.z.string()).min(1, 'memberIds is required for direct conversations.'),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('group'),
        name: zod_1.z.string().min(1, 'name is required for group conversations.'),
        memberIds: zod_1.z.array(zod_1.z.string()).min(2, 'A group requires at least 2 other members.'),
    }),
]);
const AddMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'userId is required.'),
});
const NotificationPrefsSchema = zod_1.z.object({
    enabled: zod_1.z.boolean({
        required_error: 'enabled is required',
        invalid_type_error: 'enabled must be a boolean',
    }),
});
// Maps a service-thrown error ({code,message,status}) onto an HTTP response.
function handleServiceError(res, err) {
    const e = err;
    res.status(e.status ?? 500).json({
        error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error.' },
    });
}
// ── POST /conversations ────────────────────────────────────────────────────
// Create a direct or group conversation.
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const parsed = CreateConversationSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map((e) => e.message).join('; ') },
        });
        return;
    }
    try {
        const requesterId = req.userId;
        const result = parsed.data.type === 'direct'
            ? await (0, conversationService_1.createConversation)({
                type: 'direct',
                requesterId,
                otherUserId: parsed.data.memberIds[0],
            })
            : await (0, conversationService_1.createConversation)({
                type: 'group',
                requesterId,
                name: parsed.data.name,
                memberIds: parsed.data.memberIds,
            });
        res.status(result.created ? 201 : 200).json(result.conversation);
    }
    catch (err) {
        handleServiceError(res, err);
    }
});
// ── GET /conversations ─────────────────────────────────────────────────────
// List all conversations for the authenticated user (sorted by lastMessageAt).
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const conversations = await (0, conversationService_1.getUserConversations)(req.userId);
        res.status(200).json(conversations);
    }
    catch (err) {
        handleServiceError(res, err);
    }
});
// ── POST /conversations/:id/members ────────────────────────────────────────
// Add a member to a group conversation (admin only).
router.post('/:id/members', auth_1.authenticateToken, async (req, res) => {
    const parsed = AddMemberSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map((e) => e.message).join('; ') },
        });
        return;
    }
    try {
        const conversation = await (0, conversationService_1.addMember)(req.params.id, req.userId, parsed.data.userId);
        res.status(200).json(conversation);
    }
    catch (err) {
        handleServiceError(res, err);
    }
});
// ── DELETE /conversations/:id/members/me ───────────────────────────────────
// Leave a conversation.
router.delete('/:id/members/me', auth_1.authenticateToken, async (req, res) => {
    try {
        await (0, conversationService_1.leaveConversation)(req.params.id, req.userId);
        res.status(204).send();
    }
    catch (err) {
        handleServiceError(res, err);
    }
});
// ── PATCH /conversations/:id/notification-prefs ────────────────────────────
router.patch('/:id/notification-prefs', auth_1.authenticateToken, async (req, res) => {
    const conversationId = req.params.id;
    const userId = req.userId;
    if (!mongoose_1.Types.ObjectId.isValid(conversationId)) {
        res.status(400).json({
            error: { code: 'INVALID_CONVERSATION_ID', message: 'Invalid conversation ID.' },
        });
        return;
    }
    const conversation = await models_1.Conversation.findById(conversationId).lean();
    if (!conversation) {
        res.status(404).json({
            error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' },
        });
        return;
    }
    const isMember = conversation.members.some((m) => m.userId.toString() === userId);
    if (!isMember) {
        res.status(403).json({
            error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this conversation.' },
        });
        return;
    }
    const parsed = NotificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map((e) => e.message).join('; ') },
        });
        return;
    }
    await User_1.default.findByIdAndUpdate(userId, {
        $set: { [`notificationPrefs.${conversationId}`]: parsed.data.enabled },
    });
    res.status(200).json({ enabled: parsed.data.enabled });
});
exports.default = router;
//# sourceMappingURL=conversations.js.map