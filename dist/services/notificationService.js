"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCapsuleUnlockNotification = exports.sendNewMessageNotification = void 0;
const firebase_1 = require("../config/firebase");
const User_1 = __importDefault(require("../models/User"));
// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Remove a stale device token from a user's `deviceTokens[]` array.
 * Called when FCM/APNs rejects a token (e.g. app uninstalled).
 *
 * Requirements: 10.1
 */
async function removeStaleToken(userId, token) {
    await User_1.default.findByIdAndUpdate(userId, {
        $pull: { deviceTokens: token },
    });
}
/**
 * Send a multicast FCM/APNs notification to all device tokens for a user.
 * Automatically removes any tokens that are rejected by the push provider.
 *
 * @param recipientId - MongoDB user ID of the notification recipient
 * @param notification - FCM notification payload (title + body)
 * @param data         - Optional key-value data payload
 */
async function sendToUser(recipientId, notification, data) {
    const user = await User_1.default.findById(recipientId).select('deviceTokens').lean();
    if (!user || user.deviceTokens.length === 0) {
        return; // No registered tokens — nothing to send
    }
    const messaging = firebase_1.admin.messaging();
    // Send to each token individually so we can handle per-token errors
    const results = await Promise.allSettled(user.deviceTokens.map((token) => messaging.send({
        token,
        notification,
        ...(data ? { data } : {}),
    })));
    // Remove stale tokens on rejection
    const staleTokens = [];
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            const err = result.reason;
            // FCM error codes that indicate a permanently invalid token
            const staleErrorCodes = [
                'messaging/invalid-registration-token',
                'messaging/registration-token-not-registered',
                'messaging/invalid-argument',
            ];
            if (err?.code && staleErrorCodes.includes(err.code)) {
                staleTokens.push(user.deviceTokens[index]);
            }
        }
    });
    if (staleTokens.length > 0) {
        await Promise.all(staleTokens.map((token) => removeStaleToken(recipientId, token)));
    }
}
// ── Public API ─────────────────────────────────────────────────────────────
/**
 * Send a push notification for a new message to a recipient.
 *
 * Checks the recipient's `notificationPrefs[conversationId]` before sending.
 * The preference defaults to `true` (enabled) when no entry exists.
 *
 * The notification body is truncated to 100 characters per the spec.
 *
 * Requirements: 10.1, 10.2, 10.6
 *
 * @param recipientId - MongoDB user ID of the message recipient
 * @param sender      - Sender info used to build the notification title
 * @param message     - Message info (conversationId + content)
 */
async function sendNewMessageNotification(recipientId, sender, message) {
    // Check per-conversation notification preference (default: enabled)
    const recipient = await User_1.default.findById(recipientId)
        .select('notificationPrefs deviceTokens')
        .lean();
    if (!recipient) {
        return;
    }
    const prefEnabled = recipient.notificationPrefs?.[message.conversationId] !== false;
    if (!prefEnabled) {
        // Notifications disabled for this conversation — suppress silently
        return;
    }
    const body = message.content.slice(0, 100);
    await sendToUser(recipientId, { title: sender.displayName, body }, {
        conversationId: message.conversationId,
        type: 'new_message',
    });
}
exports.sendNewMessageNotification = sendNewMessageNotification;
/**
 * Send a push notification when a capsule message is unlocked.
 *
 * Requirements: 10.1, 10.2
 *
 * @param recipientId - MongoDB user ID of the capsule recipient
 * @param messageId   - ID of the unlocked capsule message
 */
async function sendCapsuleUnlockNotification(recipientId, messageId) {
    await sendToUser(recipientId, {
        title: 'Capsule Opened',
        body: 'A time capsule message is now available to read.',
    }, {
        messageId,
        type: 'capsule_unlock',
    });
}
exports.sendCapsuleUnlockNotification = sendCapsuleUnlockNotification;
//# sourceMappingURL=notificationService.js.map