import { Application } from 'express';
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
export declare function createApp(): Application;
//# sourceMappingURL=app.d.ts.map