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
export function sanitiseMessage(msg: Record<string, unknown>): Record<string, unknown> {
  const capsule = msg.capsule as Record<string, unknown> | undefined;
  if (capsule && capsule.enabled === true && capsule.status === 'locked') {
    // Remove content so it is never sent to the client while locked
    delete msg.content;
  }
  return msg;
}

/**
 * Sanitise an array of raw message objects in-place.
 */
export function sanitiseMessages(
  msgs: Record<string, unknown>[]
): Record<string, unknown>[] {
  return msgs.map(sanitiseMessage);
}

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
export function capsuleGuard(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Wrap res.json so we can intercept the payload before it is serialised
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    if (body !== null && typeof body === 'object') {
      if (Array.isArray(body)) {
        // Top-level array of messages
        body = sanitiseMessages(body as Record<string, unknown>[]);
      } else {
        const obj = body as Record<string, unknown>;

        if (Array.isArray(obj.messages)) {
          // Wrapper object: { messages: [...] }
          obj.messages = sanitiseMessages(
            obj.messages as Record<string, unknown>[]
          );
        } else if (obj.capsule !== undefined || obj.content !== undefined) {
          // Looks like a single message object
          sanitiseMessage(obj);
        }
      }
    }

    return originalJson(body);
  };

  next();
}
