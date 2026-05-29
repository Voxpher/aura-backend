import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import conversationsRouter from './routes/conversations';
import authRouter from './routes/auth';
import messagesRouter from './routes/messages';
import usersRouter from './routes/users';

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
export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/auth', authRouter);
  app.use('/conversations', conversationsRouter);
  app.use('/conversations/:conversationId/messages', messagesRouter);
  // Echo Thread endpoints: POST /messages/:id/replies, GET /messages/:id/thread
  app.use('/messages', messagesRouter);
  app.use('/users', usersRouter);

  // Global error handler — keeps malformed requests from spamming stack traces.
  app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
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

