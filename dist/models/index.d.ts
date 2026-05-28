/**
 * Barrel export for all Mongoose models.
 * Import from this file to access any model or its associated types.
 */
export { default as User, UserSchema } from './User';
export type { IUser, INotificationPrefs } from './User';
export { default as Conversation, ConversationSchema } from './Conversation';
export type { IConversation, IConversationMember, ConversationType, MemberRole } from './Conversation';
export { default as Message, MessageSchema } from './Message';
export type { IMessage, ICapsule, CapsuleType, CapsuleStatus } from './Message';
export { default as Mood, MoodSchema } from './Mood';
export type { IMood } from './Mood';
export { default as PendingEvent, PendingEventSchema } from './PendingEvent';
export type { IPendingEvent, PendingEventType } from './PendingEvent';
//# sourceMappingURL=index.d.ts.map