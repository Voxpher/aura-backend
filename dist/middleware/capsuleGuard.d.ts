import { Request, Response, NextFunction } from 'express';
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
export declare function sanitiseMessage(msg: Record<string, unknown>): Record<string, unknown>;
/**
 * Sanitise an array of raw message objects in-place.
 */
export declare function sanitiseMessages(msgs: Record<string, unknown>[]): Record<string, unknown>[];
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
export declare function capsuleGuard(_req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=capsuleGuard.d.ts.map