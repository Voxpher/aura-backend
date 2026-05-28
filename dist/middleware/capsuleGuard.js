"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capsuleGuard = exports.sanitiseMessages = exports.sanitiseMessage = void 0;
/**
 * Strips the `content` field from any message object (or array of message
 * objects) in `res.locals.messages` / `res.locals.message` where the capsule
 * is enabled and still locked.
 *
 * This middleware MUST be applied to every endpoint that returns message
 * data so that locked capsule content is never transmitted to clients.
 *
 * Requirements: 4.5, 4.11, 4.12
 * Property 12: Locked Capsule Content Never Exposed
 */
/**
 * Sanitise a single raw message object in-place.
 * Works on plain JS objects (lean() results or toObject() results).
 */
function sanitiseMessage(msg) {
    const capsule = msg.capsule;
    if (capsule && capsule.enabled === true && capsule.status === 'locked') {
        // Remove content so it is never sent to the client while locked
        delete msg.content;
    }
    return msg;
}
exports.sanitiseMessage = sanitiseMessage;
/**
 * Sanitise an array of raw message objects in-place.
 */
function sanitiseMessages(msgs) {
    return msgs.map(sanitiseMessage);
}
exports.sanitiseMessages = sanitiseMessages;
/**
 * Express response middleware that intercepts `res.json()` and strips
 * `content` from any locked capsule message before the payload is sent.
 *
 * Handles three shapes:
 *   - A single message object at the top level  → `{ _id, content, capsule, … }`
 *   - An array of messages at the top level     → `[{ … }, { … }]`
 *   - A wrapper object with a `messages` array  → `{ messages: [{ … }] }`
 *
 * Requirements: 4.5, 4.11, 4.12
 */
function capsuleGuard(_req, res, next) {
    // Wrap res.json so we can intercept the payload before it is serialised
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        if (body !== null && typeof body === 'object') {
            if (Array.isArray(body)) {
                // Top-level array of messages
                body = sanitiseMessages(body);
            }
            else {
                const obj = body;
                if (Array.isArray(obj.messages)) {
                    // Wrapper object: { messages: [...] }
                    obj.messages = sanitiseMessages(obj.messages);
                }
                else if (obj.capsule !== undefined || obj.content !== undefined) {
                    // Looks like a single message object
                    sanitiseMessage(obj);
                }
            }
        }
        return originalJson(body);
    };
    next();
}
exports.capsuleGuard = capsuleGuard;
//# sourceMappingURL=capsuleGuard.js.map