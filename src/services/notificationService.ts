import { admin } from '../config/firebase';
import User from '../models/User';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SenderInfo {
  displayName: string;
}

export interface MessageInfo {
  conversationId: string;
  content: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Remove a stale device token from a user's `deviceTokens[]` array.
 * Called when FCM/APNs rejects a token (e.g. app uninstalled).
 *
 * Requirements: 10.1
 */
async function removeStaleToken(userId: string, token: string): Promise<void> {
  await User.findByIdAndUpdate(userId, {
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
async function sendToUser(
  recipientId: string,
  notification: { title: string; body: string },
  data?: Record<string, string>
): Promise<void> {
  const user = await User.findById(recipientId).select('deviceTokens').lean();
  if (!user || user.deviceTokens.length === 0) {
    return; // No registered tokens — nothing to send
  }

  const messaging = admin.messaging();

  // Send to each token individually so we can handle per-token errors
  const results = await Promise.allSettled(
    user.deviceTokens.map((token) =>
      messaging.send({
        token,
        notification,
        ...(data ? { data } : {}),
      })
    )
  );

  // Remove stale tokens on rejection
  const staleTokens: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const err = result.reason as { code?: string };
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
    await Promise.all(
      staleTokens.map((token) => removeStaleToken(recipientId, token))
    );
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
export async function sendNewMessageNotification(
  recipientId: string,
  sender: SenderInfo,
  message: MessageInfo
): Promise<void> {
  // Check per-conversation notification preference (default: enabled)
  const recipient = await User.findById(recipientId)
    .select('notificationPrefs deviceTokens')
    .lean();

  if (!recipient) {
    return;
  }

  const prefEnabled =
    recipient.notificationPrefs?.[message.conversationId] !== false;

  if (!prefEnabled) {
    // Notifications disabled for this conversation — suppress silently
    return;
  }

  const body = message.content.slice(0, 100);

  await sendToUser(
    recipientId,
    { title: sender.displayName, body },
    {
      conversationId: message.conversationId,
      type: 'new_message',
    }
  );
}

/**
 * Send a push notification when a capsule message is unlocked.
 *
 * Requirements: 10.1, 10.2
 *
 * @param recipientId - MongoDB user ID of the capsule recipient
 * @param messageId   - ID of the unlocked capsule message
 */
export async function sendCapsuleUnlockNotification(
  recipientId: string,
  messageId: string
): Promise<void> {
  await sendToUser(
    recipientId,
    {
      title: 'Capsule Opened',
      body: 'A time capsule message is now available to read.',
    },
    {
      messageId,
      type: 'capsule_unlock',
    }
  );
}
