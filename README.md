# Aura Backend

Node.js + Express backend for the Aura mood-first messaging app. Provides a REST API and Socket.io real-time gateway consumed by the Flutter client.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 |
| Framework | Express 4 |
| Real-time | Socket.io 4 |
| Database | MongoDB Atlas via Mongoose 8 |
| Media | Cloudinary 2 |
| Push Notifications | Firebase Admin SDK 12 (FCM / APNs) |
| Auth | JWT (jsonwebtoken 9) + bcrypt 5 |
| Scheduling | node-cron 3 |
| Testing | Jest 29 + fast-check 3 |

---

## Local Setup

### Prerequisites

- Node.js 20+
- npm 9+
- A running MongoDB instance (local or Atlas)
- Cloudinary account (free tier works)
- Firebase project with a service account

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all values (see [Environment Variables](#environment-variables) below).

### 3. Run in development mode

```bash
npm run dev
```

Nodemon watches `src/` and restarts on changes. The server starts on `PORT` (default `3000`).

### 4. Build for production

```bash
npm run build
npm start
```

### 5. Run tests

```bash
npm test
```

All Jest + fast-check property tests run in band (sequential) to avoid port conflicts.

---

## Environment Variables

Copy `.env.example` to `.env` and set each value:

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default `3000`) |
| `MONGO_URI` | MongoDB connection string (Atlas or local) |
| `JWT_SECRET` | Secret used to sign/verify JWTs (min 32 chars recommended) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account client email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key (with `\n` newlines) |
| `CORS_ORIGIN` | Allowed CORS origin (default `*`; tighten in production) |

> **Alternative Firebase config**: You can also set `FIREBASE_SERVICE_ACCOUNT_JSON` as a single JSON string containing the full service account object, then parse it in `src/config/firebase.ts` if preferred.

---

## REST API Endpoints

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Register a new account. Returns `{ token, user }`. |
| `POST` | `/auth/login` | No | Login with email + password. Returns `{ token, user }`. |
| `POST` | `/auth/logout` | Yes | Invalidate the current JWT (adds `jti` to blocklist). |

**Register body:**
```json
{ "username": "alice", "email": "alice@example.com", "password": "s3cr3tP@ss" }
```

**Login body:**
```json
{ "email": "alice@example.com", "password": "s3cr3tP@ss" }
```

---

### Conversations

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/conversations` | Yes | List the authenticated user's conversations, sorted by most recent message. |
| `POST` | `/conversations` | Yes | Create a direct or group conversation. |
| `POST` | `/conversations/:id/members` | Yes (admin) | Add a member to a group conversation. |
| `DELETE` | `/conversations/:id/members/me` | Yes | Leave a conversation. Auto-promotes longest-standing member if leaving user is last admin. |
| `PATCH` | `/conversations/:id/notification-prefs` | Yes | Toggle push notifications for a conversation. |

**Create conversation body (direct):**
```json
{ "type": "direct", "memberIds": ["<userId>"] }
```

**Create conversation body (group):**
```json
{ "type": "group", "name": "Weekend Plans", "memberIds": ["<userId1>", "<userId2>"] }
```

---

### Messages

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/conversations/:id/messages` | Yes | Paginated message history. Supports `?limit=50&before=<messageId>`. |
| `POST` | `/conversations/:id/messages` | Yes | Send a message (with mood, optional capsule config). |
| `POST` | `/messages/:id/replies` | Yes | Reply in an Echo Thread. |
| `GET` | `/messages/:id/thread` | Yes | Fetch the full Echo Thread for a message (nested, up to depth 5). |
| `POST` | `/messages/:id/condition-met` | Yes | Signal that a condition-based capsule's condition is met. |

**Send message body:**
```json
{
  "content": "Hey, how are you?",
  "moodId": "happy",
  "capsule": {
    "enabled": false
  }
}
```

**Send capsule message (time-based):**
```json
{
  "content": "Open this tomorrow!",
  "moodId": "excited",
  "capsule": {
    "enabled": true,
    "type": "time",
    "unlockAt": "2025-12-31T00:00:00.000Z"
  }
}
```

**Send capsule message (condition-based):**
```json
{
  "content": "Read this when you're ready.",
  "moodId": "calm",
  "capsule": {
    "enabled": true,
    "type": "condition",
    "conditionId": "open_when_free"
  }
}
```

> **Note:** Locked capsule messages have their `content` field stripped from all API responses until unlocked.

---

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/search?q=` | Yes | Search users by username prefix (max 20 results). |
| `GET` | `/users/:id` | Yes | Get a user's public profile (`displayName`, `avatarUrl`, `currentMoodId`, `activityLevel`). |
| `PATCH` | `/users/me` | Yes | Update display name and/or mood status. |
| `POST` | `/users/me/avatar` | Yes | Upload a profile picture to Cloudinary (multipart/form-data, field `avatar`, max 5 MB, JPEG/PNG/GIF/WebP). |
| `POST` | `/users/me/device-token` | Yes | Register an FCM/APNs device token for push notifications. |
| `PATCH` | `/users/me/activity` | Yes | Update the authenticated user's last-activity timestamp (call on every client interaction). |

**Update profile body:**
```json
{ "displayName": "Alice", "currentMoodId": "calm" }
```

---

## Socket.io Events

All Socket.io connections must include the JWT in the handshake:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: '<jwt>' }
});
```

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `typing` | `{ conversationId: string }` | User started typing in a conversation. |
| `stopped_typing` | `{ conversationId: string }` | User stopped typing. |
| `message:delivered` | `{ messageId: string }` | Client confirms message delivery. |
| `message:read` | `{ messageId: string }` | Client confirms message was read. |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `new_message` | `{ message }` | New message delivered to a conversation. |
| `new_reply` | `{ reply, parentId }` | New reply added to an Echo Thread. |
| `message_delivered` | `{ messageId, recipientId }` | Delivery receipt forwarded to sender. |
| `message_read` | `{ messageId, readerId }` | Read receipt forwarded to sender. |
| `typing` | `{ conversationId, userId }` | Someone is typing in a conversation. |
| `stopped_typing` | `{ conversationId, userId }` | Someone stopped typing. |
| `pulse_board_update` | `{ groupId, blendedColor, activeCount }` | Updated Pulse Board color for a group. |
| `capsule_unlock` | `{ messageId, conversationId }` | A capsule message is now readable. |
| `presence_update` | `{ userId, activityLevel }` | A user's activity level changed (`active`/`recent`/`idle`/`away`). |
| `member_added` | `{ conversationId, userId }` | A new member joined a group conversation. |

---

## Authentication

All protected endpoints require:

```
Authorization: Bearer <jwt>
```

JWTs are signed with `HS256`, expire after **30 days**, and carry `{ userId, username }` in the payload.

**Error responses follow a consistent envelope:**

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

---

## HTTP Status Codes

| Status | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `204` | No Content |
| `400` | Validation failure |
| `401` | Missing / expired / invalid JWT |
| `403` | Forbidden (e.g., non-admin action) |
| `404` | Resource not found |
| `409` | Conflict (e.g., email already registered) |
| `429` | Rate limit / account locked |
| `500` | Internal server error |
| `502` | Upstream service failure (e.g., Cloudinary) |

---

## Project Structure

```
backend/
├── src/
│   ├── app.ts              # Express app factory + middleware
│   ├── server.ts           # HTTP server + Socket.io bootstrap + cron jobs
│   ├── config/
│   │   ├── database.ts     # MongoDB connection
│   │   ├── cloudinary.ts   # Cloudinary SDK config
│   │   └── firebase.ts     # Firebase Admin SDK init
│   ├── middleware/
│   │   └── auth.ts         # JWT authentication middleware
│   ├── models/             # Mongoose schemas (added in task 2)
│   ├── routes/             # Express routers (added in tasks 4–12)
│   ├── services/           # Business logic (added in tasks 4–12)
│   ├── seeds/              # Mood seed data (added in task 3)
│   └── types/
│       └── index.ts        # Shared TypeScript types
├── tests/                  # Jest + fast-check tests
├── config/                 # Static config files
├── .env.example            # Environment variable template
├── jest.config.js          # Jest configuration
├── nodemon.json            # Nodemon dev-server config
├── package.json
└── tsconfig.json
```
