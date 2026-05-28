import { Request } from 'express';
/**
 * Extended Express Request that carries the authenticated user's ID
 * after the `authenticateToken` middleware has validated the JWT.
 */
export interface AuthRequest extends Request {
    userId?: string;
}
//# sourceMappingURL=index.d.ts.map