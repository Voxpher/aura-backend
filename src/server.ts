import 'dotenv/config';
import http from 'http';
import cron from 'node-cron';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

import { createApp } from './app';
import { connectDatabase } from './config/database';
import { configureCloudinary } from './config/cloudinary';
import { initFirebase } from './config/firebase';
import { ensureIndexes } from './config/ensureIndexes';
import { seedMoods } from './seeds/moods';
import { initIO } from './socket';
import { runPresenceLevelCheck } from './services/presenceService';
import { runCapsuleUnlockScheduler, drainPendingEvents } from './services/capsuleService';
import { Message } from './models';

const PORT = process.env.PORT ?? 3000;

async function bootstrap(): Promise<void> {
  // External service configuration
  configureCloudinary();
  initFirebase();

  // MongoDB
  await connectDatabase();
  await ensureIndexes();
  await seedMoods();

  // Express app
  const app = createApp();
  const httpServer = http.createServer(app);

  // Socket.io (module-level singleton so route handlers can emit events)
  const io = initIO(httpServer);

  // ── Socket.io authentication middleware ──────────────────────────────────
  // Clients must pass `auth: { token: "<JWT>" }` in the handshake options.
  // The middleware attaches `socket.data.userId` for use in event handlers.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication token is required.'));
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('Server configuration error.'));
    }
    try {
      const payload = jwt.verify(token, secret) as { userId: string };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired authentication token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (userId: ${socket.data.userId as string})`);

    // Join the socket to the user's personal room (used for direct delivery
    // of events like capsule_unlock and pending event drain).
    const userId = socket.data.userId as string;
    socket.join(userId);

    // Drain any pending events queued while the user was offline (Req 4.10, 7.4)
    drainPendingEvents(io, userId).catch((err) => {
      console.error('[socket] drainPendingEvents error:', err);
    });

    // Join the socket to a conversation room so it receives new_message events
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
    });

    // ── Delivery receipt ────────────────────────────────────────────────────
    // Client emits `message:delivered` when it receives a message.
    // Server updates `deliveredTo[]` and emits `message_delivered` to the
    // conversation room so the sender sees the delivery tick.
    // Requirements: 7.2, 7.3
    socket.on('message:delivered', async (data: { messageId: string }) => {
      try {
        const { messageId } = data;
        if (!messageId || !Types.ObjectId.isValid(messageId)) return;

        const recipientId = socket.data.userId as string;

        const message = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { deliveredTo: new Types.ObjectId(recipientId) } },
          { new: true }
        );

        if (!message) return;

        // Broadcast delivery receipt to the conversation room (includes sender)
        io.to(message.conversationId.toString()).emit('message_delivered', {
          messageId,
          recipientId,
        });
      } catch (err) {
        console.error('[socket] message:delivered error:', err);
      }
    });

    // ── Read receipt ────────────────────────────────────────────────────────
    // Client emits `message:read` when the user views a message.
    // Server updates `readBy[]` and forwards `message_read` to the
    // conversation room within 500ms (Requirement 7.3).
    // Requirements: 7.3
    socket.on('message:read', async (data: { messageId: string }) => {
      try {
        const { messageId } = data;
        if (!messageId || !Types.ObjectId.isValid(messageId)) return;

        const readerId = socket.data.userId as string;

        const message = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { readBy: new Types.ObjectId(readerId) } },
          { new: true }
        );

        if (!message) return;

        // Forward read receipt to the conversation room (includes sender)
        io.to(message.conversationId.toString()).emit('message_read', {
          messageId,
          readerId,
        });
      } catch (err) {
        console.error('[socket] message:read error:', err);
      }
    });

    // ── Typing indicator ────────────────────────────────────────────────────
    // Client emits `typing` while composing a message.
    // Server broadcasts to the conversation room within 300ms (Requirement 7.5).
    // Requirements: 7.5
    socket.on('typing', (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      const userId = socket.data.userId as string;

      // Broadcast to all OTHER sockets in the room (excluding the sender)
      socket.to(conversationId).emit('typing', { conversationId, userId });
    });

    // ── Stopped-typing indicator ────────────────────────────────────────────
    // Client emits `stopped_typing` when the user stops composing.
    // Server broadcasts to the conversation room within 300ms (Requirement 7.6).
    // Requirements: 7.6
    socket.on('stopped_typing', (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      const userId = socket.data.userId as string;

      socket.to(conversationId).emit('stopped_typing', { conversationId, userId });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Capsule unlock scheduler — runs every 30 seconds (Requirement 4.6)
  // Queries for time-based locked capsules whose unlockAt <= now, updates
  // their status to "unlocked", and emits `capsule_unlock` via Socket.io
  // within 2 seconds. Offline recipients receive the event on reconnect.
  cron.schedule('*/30 * * * * *', () => {
    runCapsuleUnlockScheduler(io).catch((err) => {
      console.error('[CapsuleService] Cron job error:', err);
    });
  });

  // Presence level transition checker — runs every 30 seconds (Requirement 6.4)
  // Detects users whose activity level has changed since the last check and
  // emits `presence_update` to all relevant Socket.io rooms within 2 seconds.
  cron.schedule('*/30 * * * * *', () => {
    runPresenceLevelCheck(io).catch((err) => {
      console.error('[PresenceService] Cron job error:', err);
    });
  });

  // Start listening
  httpServer.listen(PORT, () => {
    console.log(`Aura backend listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
