import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';

interface JwtPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

/**
 * Express middleware that validates a Bearer JWT from the Authorization header.
 *
 * On success: attaches `req.userId` and calls `next()`.
 * On failure: returns 401 Unauthorized without calling `next()`.
 *
 * Requirements: 1.5, 1.8
 */
export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication token is required.',
      },
    });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({
      error: {
        code: 'SERVER_CONFIGURATION_ERROR',
        message: 'Server is not properly configured.',
      },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or has expired.',
      },
    });
  }
}
