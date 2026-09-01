# Project Report: Real-Time Chat Application

## 1. What this project is

This repository is a real-time, one-to-one web chat application. A person can
create an account, verify their email address, sign in, choose another registered
user, exchange text and image messages, see online presence, receive unread badges,
and track sent, delivered, and read states. The browser application is the working
product surface.

## 2. Repository map

| Location | Purpose |
| --- | --- |
| `frontend/` | React 19 + Vite single-page application used by chat users. |
| `backend/` | Express API, MongoDB models, Socket.IO server, authentication, media/email/security integrations. |
| `docker-compose.yml` | Multi-container orchestration (MongoDB, Redis, Backend, Frontend). |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline running linting, tests, and Docker build validation. |
| `BENCHMARKS.md` | Load test methodology, hardware environment notes, and measured throughput/latency figures. |
| `README.MD` | High-level architecture overview and getting-started guide. |
| root `package.json` | Convenience build, start, and test commands. |

## 3. Stack and external services

### Browser client

- React 19 renders pages and components.
- React Router manages client routing across `/`, `/login`, `/signup`, `/verify-email/:token`, `/forgot-password`, and `/reset-password/:token`.
- Zustand holds shared authentication and chat state.
- Axios calls the REST API and sends cookies with every request.
- Socket.IO Client receives presence, messages, typing indicators, and status events.
- Tailwind CSS provides the visual design system; Lucide provides icons.
- React Hot Toast displays success and error notifications.

### Web backend

- Node.js 20+ with Express receives REST requests.
- MongoDB/Mongoose persist users and messages.
- Socket.IO supplies browser real-time events.
- JWT in an HTTP-only `jwt` cookie authenticates HTTP and Socket.IO requests.
- Cloudinary stores profile and chat images.
- Resend handles verification and password-reset emails.
- Arcjet applies a shield rule, bot detection, and rate limiting to API routes.
- Optional Redis (`REDIS_URL`) enables `@socket.io/redis-adapter` and cross-instance presence tracking for horizontal scaling.
- Pino and Pino HTTP provide structured JSON logging in production, pretty printing in development, and automated HTTP request-duration logging.
- Prom-client collects default Node.js runtime metrics alongside custom counters and histograms in Prometheus exposition format.

## 4. User experience and visual design

The product deliberately uses a dark, futuristic “glass” interface.

- The app background is slate/near-black with a fine grid and soft cyan, pink,
  and indigo glows. The main chat area adds radial teal/indigo gradients.
- Login and registration are centered, translucent cards on an animated dark
  gradient background with blurred cyan, purple, and blue light blobs. Fields
  have email/password/person icons, rounded corners, and cyan focus rings.
- The chat desktop layout is a full-screen rounded glass panel with an animated
  cyan/blue conic-gradient border. The 240–260 px left sidebar contains the
  owner profile, logout and sound controls, a Chats/Contacts pill switch, and
  user cards. On mobile viewports (<768px), it collapses to a single-pane layout.
- User cards show a fallback avatar (`public/avatar.png`), online/offline dot,
  name, last message preview, and unread badges. Hovering brightens
  the card and its cyan border.
- The active conversation has a header, scrollable timeline, image lightbox expand,
  timestamps, outgoing cyan message bubbles, incoming dark bubbles, and
  check-mark delivery indicators. The composer supports an auto-growing textarea,
  image preview/removal, attach icon, send button, and typing indicators.
- Empty, loading, and initial states are intentionally designed: animated
  skeletons, “select a conversation,” “no conversations,” and “start your
  conversation” displays. Quick-reply suggestions prefill text into the message input.
- Optional sounds include random keystrokes, a control click, and a new-message
  notification. The sound setting is retained in `localStorage`.

## 5. Functional walkthrough

### Account lifecycle

1. On startup, `App` calls `GET /api/auth/check`. Until it resolves, a spinner
   fills the page.
2. An unauthenticated visitor is redirected to `/login`; an authenticated
   visitor is redirected to `/`.
3. Sign-up validates required fields, a six-character password minimum, and email
   format/uniqueness. The password is bcrypt-hashed, the user is saved with
   `isEmailVerified: false`, and a verification email with a secure token is sent.
4. Email verification via `/verify-email/:token` validates the token, marks the
   account verified, sends a welcome email, issues a 7-day JWT cookie, and logs in.
5. Login verifies credentials, enforces that email verification is complete,
   and issues the JWT cookie.
6. Password reset allows requesting a reset link via email and setting a new
   password via a timed token.
7. Logout clears the cookie and disconnects the browser socket.
8. A profile image is read in the browser as a base64 data URL, sent to the API,
   uploaded to Cloudinary, and saved as the user's `profilePic` URL.

### Finding conversations

- **Contacts** lists all verified registered users except the current user with search filtering.
- **Chats** lists users who have active message history with the current user, sorted by recent activity with real-time last-message previews.
- Selecting a person fetches that bilateral conversation and sends a Socket.IO
  read receipt. Escape, back arrow, or the header close icon deselects it.
- Presence tracks connected user IDs across all instances via Redis (or in-memory fallback).

### Sending and receiving messages

1. The composer accepts text, an image, or both. Browser image files are
   converted to base64 and previewed locally.
2. The client immediately inserts a temporary `sending` bubble (optimistic UI).
3. `POST /api/messages/send/:receiverId` validates the payload, prevents
   self-messaging, optionally uploads the image to Cloudinary, creates MongoDB
   data with status `sent`, and returns it.
4. If the recipient is online (checked across instances via Redis/memory), the message
   is marked `delivered` and emitted to the recipient's `user:<id>` room. It is also
   emitted to the sender's room to sync multiple tabs/devices.
5. The sender's temporary bubble is replaced with the stored message. A failed
   API request removes it and shows a toast.
6. Incoming messages update conversation history and refresh chat list previews in real time.
   The notification sound plays when enabled.
7. Opening a chat emits `messageRead`; the server updates outstanding incoming
   messages to `read` and informs the sender. The UI uses one check for sent,
   two gray checks for delivered, blue double checks for read, and a hollow
   circle while optimistic sending is in progress.

### History

The API returns the newest 50 messages, sorts them back into chronological
order for display, and accepts an ISO timestamp cursor for older messages.
Scrolling near the top requests the next page and restores scroll position so
the view does not jump. MongoDB indexes `senderId + receiverId + createdAt` and
`receiverId + status`.

## 6. HTTP API

All endpoints are prefixed by `/api` unless otherwise noted. Authenticated endpoints require the JWT cookie.

| Method and path | Auth | Behavior |
| --- | --- | --- |
| `POST /auth/signup` | No | Creates user, sets pending verification, sends verification email. |
| `POST /auth/verify-email` | No | Validates token, marks verified, sends welcome email, sets JWT cookie. |
| `POST /auth/resend-verification` | No | Resends email verification link. |
| `POST /auth/login` | No | Verifies credentials, checks email verification, sets cookie. |
| `POST /auth/forgot-password` | No | Generates reset token and sends password reset email. |
| `POST /auth/reset-password/:token` | No | Resets password using valid unexpired token. |
| `POST /auth/logout` | No | Expires the `jwt` cookie. |
| `GET /auth/check` | Yes | Returns current user without password. |
| `PUT /auth/update-profile` | Yes | Uploads base64 profile image and returns updated user. |
| `GET /messages/contacts` | Yes | Verified users, sans passwords. |
| `GET /messages/chats` | Yes | Chat partners with latest message previews, sorted newest first. |
| `GET /messages/:id?cursor=&limit=50` | Yes | One-to-one history with cursor pagination. |
| `POST /messages/send/:id` | Yes | Saves a text/image message and returns `{ ack, message }`. |
| `PUT /messages/:id/read` | Yes | Marks a sender's messages as read. |
| `GET /api/health` | No | Reports overall status, uptime, and live connectivity for MongoDB and Redis. |
| `GET /metrics` | No | Prometheus exposition format metrics (HTTP metrics, active sockets, message counts). |

## 7. Real-time contract

The Socket.IO server authenticates the `jwt` cookie during its handshake, adds
each socket to `user:<userId>`, and emits or consumes these events:

| Direction | Event | Payload / outcome |
| --- | --- | --- |
| Server → all | `getOnlineUsers` | Array of currently connected user IDs. |
| Server → recipient/sender | `newMessage` | The new persisted message. |
| Server → sender | `messageStatusUpdated` | Message ID, `delivered`, and timestamp. |
| Client → server | `messageRead` | `{ senderId }`; writes read status for that conversation. |
| Server → sender | `messagesMarkedRead` | Reader ID and read timestamp. |
| Client → server | `typing` / `stopTyping` | `{ receiverId }`; relays typing status to partner. |
| Server → recipient | `typing` / `stopTyping` | `{ senderId }`; triggers typing indicator in UI. |

## 8. Data model

### User

`email` (unique, lowercase, trimmed), `fullName`, bcrypt `password`, optional `profilePic`,
`isEmailVerified`, `emailVerifyToken`, `emailVerifyExpires`, `passwordResetToken`,
`passwordResetExpires`, and Mongoose-created `createdAt`/`updatedAt` timestamps.

### Message

`senderId`, `receiverId`, optional trimmed text (maximum 2,000 characters),
optional Cloudinary image URL, status (`sent`, `delivered`, `read`), optional
delivery/read timestamps, and creation/update timestamps.

## 9. Configuration and local operation

Refer to `backend/.env.example` for all required environment variables:

```dotenv
PORT=3000
MONGO_URI=mongodb://...
JWT_SECRET=long-random-secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
LOG_LEVEL=info
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM=...
EMAIL_FROM_NAME=...
ARCJET_KEY=...
# Optional for multi-instance Socket.IO broadcasts
REDIS_URL=redis://...
```

Common development commands:

```bash
npm install --prefix backend
npm install --prefix frontend
npm run dev --prefix backend
npm run dev --prefix frontend
```

To run test suites:

```bash
npm run test:backend
```

## 10. Observability, CI/CD, and performance benchmarks

### Observability and metrics

- **Health check (`GET /api/health`)**: Probes downstream dependencies in real time. It checks MongoDB connection readiness (`readyState === 1`) and issues a `PING` command to Redis when `REDIS_URL` is set. When Redis is omitted, the response safely returns `redis: { status: "disabled" }` without failing the probe. Returns HTTP 200 with uptime and subsystem details when healthy, or HTTP 503 on service disruption.
- **Prometheus metrics (`GET /metrics`)**: Scraped by Prometheus or compatible collectors via `prom-client`. Gathers default runtime metrics (memory usage, event loop lag, active handles) alongside custom domain metrics:
  - `http_requests_total`: Request count partitioned by HTTP method, route, and status code.
  - `http_request_duration_seconds`: Request duration histogram across standard latency buckets.
  - `socket_connections_active`: Gauge tracking live Socket.IO client connections.
  - `messages_sent_total`: Counter tracking successfully saved and dispatched chat messages.
- **Structured logging**: Managed by Pino (`backend/src/lib/logger.js`). Outputs JSON formatted records in production and pretty-printed logs via `pino-pretty` in development. Request boundaries and response times are captured automatically by `pino-http` middleware, with health and metrics endpoints excluded to minimize log noise.

### CI/CD pipeline

The continuous integration pipeline in `.github/workflows/ci.yml` triggers on every push and pull request targeting the `main` branch. It executes three validation jobs:

1. **`backend`**: Sets up Node.js 20 with npm caching, runs `npm ci --prefix backend`, lints via ESLint (`npm run lint --prefix backend`), caches the MongoDB memory server binary (`~/.cache/mongodb-binaries`) keyed to the `mongodb-memory-server` version in `backend/package-lock.json`, and executes all Vitest integration tests (`npm test --prefix backend`).
2. **`frontend`**: Sets up Node.js 20 with npm caching, installs dependencies, validates linting rules with ESLint (`npm run lint --prefix frontend`), and compiles the Vite production asset bundle (`npm run build --prefix frontend`).
3. **`docker`**: Validates `docker-compose.yml` configuration syntax (`docker compose config`) and builds both backend and frontend container images (`docker compose build backend frontend`) to detect Dockerfile regressions before deployment.

### Load testing and published benchmarks

The repository provides a k6 load test suite under `backend/loadtest/` with a standalone benchmark runner (`runner.js`) and realistic user flow script (`chat-flow.js`). The test exercises login authentication, contact discovery, message history retrieval, message dispatch with delivery ACKs, and persistent Socket.IO WebSocket connections with heartbeat handling.

- At **50 concurrent virtual users**, the server sustained **58.37 HTTP req/sec** with a **0.00% error rate**, **100% message delivery ACK success**, and a median request latency of **398.14 ms**.
- At **200 concurrent virtual users**, throughput scaled to **69.02 HTTP req/sec** with an error rate of **0.08%** and median latency of **1,509.00 ms**.
- Complete methodology, percentile latency curves, and execution environment notes are documented in [`BENCHMARKS.md`](./BENCHMARKS.md).

## 11. Best starting points for a new contributor

1. Read `frontend/src/App.jsx`, then the Zustand stores (`useAuthStore.js`, `useChatStore.js`).
2. Read `backend/src/server.js`, `backend/src/lib/createApp.js`, route files, controllers, then `backend/src/lib/socket.js`.
3. Check `backend/src/models/Message.js` and `User.js` to understand persistence and indexes.
4. Review automated tests under `backend/tests/` to understand API specifications and validation behavior.
5. Review `.github/workflows/ci.yml` and `backend/loadtest/` for testing standards, CI checks, and load profile scripts.
