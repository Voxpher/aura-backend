import express, { Application, Request, Response } from 'express';
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

  return app;
}

