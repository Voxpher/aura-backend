"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Express middleware that validates a Bearer JWT from the Authorization header.
 *
 * On success: attaches `req.userId` and calls `next()`.
 * On failure: returns 401 Unauthorized without calling `next()`.
 *
 * Requirements: 1.5, 1.8
 */
function authenticateToken(req, res, next) {
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
        const payload = jsonwebtoken_1.default.verify(token, secret);
        req.userId = payload.userId;
        next();
    }
    catch {
        res.status(401).json({
            error: {
                code: 'INVALID_TOKEN',
                message: 'Authentication token is invalid or has expired.',
            },
        });
    }
}
exports.authenticateToken = authenticateToken;
//# sourceMappingURL=auth.js.map