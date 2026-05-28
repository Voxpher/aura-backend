import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
/**
 * Express middleware that validates a Bearer JWT from the Authorization header.
 *
 * On success: attaches `req.userId` and calls `next()`.
 * On failure: returns 401 Unauthorized without calling `next()`.
 *
 * Requirements: 1.5, 1.8
 */
export declare function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map