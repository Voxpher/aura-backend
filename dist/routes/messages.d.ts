/**
 * Messages router.
 *
 * This router is mounted in two places:
 *   1. `/conversations/:conversationId/messages` — for sending and listing
 *      messages within a conversation (mergeParams: true so :conversationId
 *      is accessible).
 *   2. `/messages` — for Echo Thread operations that reference a message
 *      directly by its own ID.
 *
 * Requirements: 2.3, 2.4, 2.8, 2.9, 5.3, 5.6, 5.8, 7.1
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=messages.d.ts.map