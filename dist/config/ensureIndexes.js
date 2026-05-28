"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureIndexes = void 0;
const models_1 = require("../models");
/**
 * Synchronises all Mongoose schema indexes with MongoDB at startup.
 *
 * `Model.syncIndexes()` drops any indexes that are no longer defined in the
 * schema and creates any that are missing, making the database state match
 * the schema definitions exactly.
 *
 * Indexes managed per collection:
 *
 * users
 *   - { email: 1 }      unique  — login lookup
 *   - { username: 1 }   unique  — user search
 *
 * messages
 *   - { conversationId: 1, createdAt: -1 }          — paginated history
 *   - { parentMessageId: 1 }                         — Echo Thread fetch
 *   - { "capsule.unlockAt": 1, "capsule.status": 1 } — capsule scheduler
 *
 * conversations
 *   - { "members.userId": 1 } — user's conversation list
 *
 * pendingEvents
 *   - { recipientId: 1, createdAt: 1 } — offline delivery drain
 */
async function ensureIndexes() {
    await Promise.all([
        models_1.User.syncIndexes(),
        models_1.Conversation.syncIndexes(),
        models_1.Message.syncIndexes(),
        models_1.PendingEvent.syncIndexes(),
    ]);
    console.log('MongoDB indexes synchronised');
}
exports.ensureIndexes = ensureIndexes;
//# sourceMappingURL=ensureIndexes.js.map