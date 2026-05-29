"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const conversations_1 = __importDefault(require("./routes/conversations"));
const auth_1 = __importDefault(require("./routes/auth"));
const messages_1 = __importDefault(require("./routes/messages"));
const users_1 = __importDefault(require("./routes/users"));
/**
 * Creates and configures the Express application.
 *
 * Middleware applied:
 *  - CORS (permissive by default; tighten via CORS_ORIGIN env var in production)
 *  - express.json() for JSON request body parsing
 *
 * Routes will be mounted here as they are implemented.
 *
 * Requirements: 1.1, 7.1
 */
function createApp() {
    const app = (0, express_1.default)();
    // Middleware
    app.use((0, cors_1.default)({
        origin: process.env.CORS_ORIGIN ?? '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    app.use(express_1.default.json({ limit: '10mb' }));
    // Health check
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // Routes
    app.use('/auth', auth_1.default);
    app.use('/conversations', conversations_1.default);
    app.use('/conversations/:conversationId/messages', messages_1.default);
    // Echo Thread endpoints: POST /messages/:id/replies, GET /messages/:id/thread
    app.use('/messages', messages_1.default);
    app.use('/users', users_1.default);
    // Global error handler — keeps malformed requests from spamming stack traces.
    app.use((err, _req, res, next) => {
        if (res.headersSent)
            return next(err);
        // Malformed JSON body (body-parser sets type 'entity.parse.failed')
        if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
            res.status(400).json({
                error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
            });
            return;
        }
        res.status(err.status ?? 500).json({
            error: { code: 'INTERNAL_ERROR', message: err.message || 'Unexpected error.' },
        });
    });
    return app;
}
exports.createApp = createApp;
//# sourceMappingURL=app.js.map