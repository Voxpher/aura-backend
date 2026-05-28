export interface SenderInfo {
    displayName: string;
}
export interface MessageInfo {
    conversationId: string;
    content: string;
}
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
export declare function sendNewMessageNotification(recipientId: string, sender: SenderInfo, message: MessageInfo): Promise<void>;
/**
 * Send a push notification when a capsule message is unlocked.
 *
 * Requirements: 10.1, 10.2
 *
 * @param recipientId - MongoDB user ID of the capsule recipient
 * @param messageId   - ID of the unlocked capsule message
 */
export declare function sendCapsuleUnlockNotification(recipientId: string, messageId: string): Promise<void>;
//# sourceMappingURL=notificationService.d.ts.map