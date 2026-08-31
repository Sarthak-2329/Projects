# Project Report: Hybrid Chat Application

## 1. What this project is

This repository is a real-time, one-to-one web chat application. A person can
create an account, sign in, choose another registered user, exchange text and
image messages, see online presence, receive unread badges, and see sent,
delivered, and read states. The browser application is the working product
surface.

The repository also contains a separate C++ TCP chat engine intended as a
high-concurrency networking core. It is a standalone server with its own
protocol; it is **not connected to the React/Express/Socket.IO application in
the current code**. The README describes that connection as an architecture
goal, but there is no code that starts the C++ executable from Node, translates
between its TCP protocol and Socket.IO, or exchanges data through Redis.

## 2. Repository map

| Location | Purpose |
| --- | --- |
| `frontend/` | React 19 + Vite single-page application used by chat users. |
| `backend/` | Express API, MongoDB models, Socket.IO server, authentication, media/email/security integrations. |
| `cpp_core/` | Independent C++17 framed-TCP room chat server. |
| `README.MD` | High-level architecture claim and technology overview. |
| root `package.json` | Convenience build/start commands for the subprojects. |

`cpp_core/include/json.hpp` is the vendored single-header nlohmann/json 3.11.3
library, rather than application-specific code.

## 3. Stack and external services

### Browser client

- React 19 renders pages and components.
- React Router protects `/`, `/login`, and `/signup` according to login state.
- Zustand holds shared authentication and chat state.
- Axios calls the REST API and sends cookies with every request.
- Socket.IO Client receives presence, messages, and status events.
- Tailwind CSS + DaisyUI provide the visual system; Lucide provides icons.
- React Hot Toast displays success and error notifications.

### Web backend

- Node.js 20+ with Express receives REST requests.
- MongoDB/Mongoose persist users and messages.
- Socket.IO supplies browser real-time events.
- JWT in an HTTP-only `jwt` cookie authenticates HTTP and Socket.IO requests.
- Cloudinary stores profile and chat images.
- Resend sends a welcome email after a successful registration.
- Arcjet applies a shield rule, bot detection, and a 100-request/60-second
  sliding-window limit to the API routes.
- Optional Redis (`REDIS_URL`) enables the Socket.IO Redis adapter so broadcast
  events can travel between Node instances.

### Separate C++ core

- C++17, buffered non-blocking socket writes, and nlohmann/json.
- Linux uses non-blocking, edge-triggered `epoll`; Windows has a limited
  `select` fallback.
- It accepts raw TCP rather than HTTP or Socket.IO.

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
  user cards.
- User cards show a fallback avatar (`public/avatar.png`), online/offline dot,
  name, state text, and for chat partners an unread badge. Hovering brightens
  the card and its cyan border.
- The active conversation has a header, scrollable timeline, image cards,
  timestamps, outgoing cyan message bubbles, incoming dark bubbles, and
  check-mark delivery indicators. The composer supports a text input, image
  preview/removal, attach icon, and send button.
- Empty, loading, and initial states are intentionally designed: animated
  skeletons, “select a conversation,” “no conversations,” and “start your
  conversation” displays. The suggested-message buttons in the empty history
  display are visual only; they do not insert or send text.
- Optional sounds include random keystrokes, a control click, and a new-message
  notification. The sound setting is retained in `localStorage`.

Two large illustrated assets (`login.png` and `signup.png`) exist under
`frontend/public`, but no component imports or displays them. The browser tab
still uses Vite's default icon and title (`frontend`).

## 5. Functional walkthrough

### Account lifecycle

1. On startup, `App` calls `GET /api/auth/check`. Until it resolves, a spinner
   fills the page.
2. An unauthenticated visitor is redirected to `/login`; an authenticated
   visitor is redirected to `/`.
3. Sign-up validates required fields, a six-character password minimum, basic
   email format, and email uniqueness. The password is bcrypt-hashed, the user
   is saved, a seven-day JWT cookie is issued, and a welcome email is attempted.
4. Login verifies the stored bcrypt password and issues the same cookie.
5. Logout clears the cookie and disconnects the browser socket.
6. A profile image is read in the browser as a base64 data URL, sent to the API,
   uploaded to Cloudinary, and saved as the user's `profilePic` URL.

### Finding conversations

- **Contacts** lists every registered user except the current user, so there is
  no friend-request/contact ownership model.
- **Chats** lists users who have ever exchanged a message with the current user.
- Selecting a person fetches that bilateral conversation and sends a Socket.IO
  read receipt. Escape or the header close icon deselects it.
- Presence is a list of user IDs with an active Socket.IO connection. Multiple
  browser tabs/devices for one user are tracked as a set of socket IDs.

### Sending and receiving messages

1. The composer accepts text, an image, or both. Browser image files are
   converted to base64 and previewed locally.
2. The client immediately inserts a temporary `sending` bubble (optimistic UI).
3. `POST /api/messages/send/:receiverId` validates the payload, prevents
   self-messaging, optionally uploads the image to Cloudinary, creates MongoDB
   data with status `sent`, and returns it.
4. If the recipient has a socket on this Node process, the message is marked
   `delivered` and emitted to the recipient's `user:<id>` Socket.IO room.
5. The sender's temporary bubble is replaced with the stored message. A failed
   API request removes it and shows a toast.
6. An incoming message for the open conversation is appended. Otherwise it
   increments an in-memory unread badge and refreshes chat partners. The
   notification sound plays when enabled.
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

All endpoints are prefixed by `/api`. Authenticated endpoints require the JWT
cookie.

| Method and path | Auth | Behavior |
| --- | --- | --- |
| `POST /auth/signup` | No | Creates user, cookie, welcome email attempt. |
| `POST /auth/login` | No | Verifies credentials and sets cookie. |
| `POST /auth/logout` | No | Expires the `jwt` cookie. |
| `GET /auth/check` | Yes | Returns current user without password. |
| `PUT /auth/update-profile` | Yes | Uploads base64 profile image and returns updated user. |
| `GET /messages/contacts` | Yes | All other users, sans passwords. |
| `GET /messages/chats` | Yes | Distinct people with existing message history. |
| `GET /messages/:id?cursor=&limit=50` | Yes | One-to-one history, newest page first internally, chronological response. |
| `POST /messages/send/:id` | Yes | Saves a text/image message and returns `{ ack, message }`. |
| `PUT /messages/:id/read` | Yes | REST alternative for marking a sender's messages read; the frontend uses Socket.IO instead. |

## 7. Real-time contract

The Socket.IO server authenticates the `jwt` cookie during its handshake, adds
each socket to `user:<userId>`, and emits or consumes these events:

| Direction | Event | Payload / outcome |
| --- | --- | --- |
| Server → all | `getOnlineUsers` | Array of currently connected user IDs. |
| Server → recipient | `newMessage` | The new persisted message. |
| Client → server | `messageDelivered` | `{ messageId, senderId }`; server writes `delivered`. |
| Server → sender | `messageStatusUpdated` | Message ID, `delivered`, and timestamp. |
| Client → server | `messageRead` | `{ senderId }`; writes read status for that conversation. |
| Server → sender | `messagesMarkedRead` | Reader ID and read timestamp. |

The web client does not emit `messageDelivered`, so the server's online-send
path is the actual delivery-status mechanism it currently relies on.

## 8. Data model

### User

`email` (unique), `fullName`, bcrypt `password`, optional `profilePic`, and
Mongoose-created `createdAt`/`updatedAt` timestamps.

### Message

`senderId`, `receiverId`, optional trimmed text (maximum 2,000 characters),
optional Cloudinary image URL, status (`sent`, `delivered`, `read`), optional
delivery/read timestamps, and creation/update timestamps. The schema does not
enforce that either text or image is present; the controller does.

## 9. C++ engine: how it works

Build it with CMake or the root `build:cpp` script (the latter explicitly links
Windows `ws2_32`, so it is not portable as written). The executable defaults to
port 8080, or accepts a port as its first argument.

It uses this TCP framing format:

```text
4-byte unsigned big-endian payload length | UTF-8 JSON payload bytes
```

Each accepted socket begins anonymous in the `default` room. A mutex-protected
`RoomManager` stores sessions, room membership, a heartbeat time, and an
accumulation buffer. That buffer permits partial receives and multiple frames
in one receive to be reconstructed safely.

Expected JSON packets include:

| `type` | Behavior |
| --- | --- |
| `PING` | Replies with `{"type":"PONG"}`. |
| `JOIN` | Moves the connection to the requested `room` and replies `JOIN_ACK`. |
| `MSG` | Frames and broadcasts the original packet to every socket in the current room. |
| other JSON | Broadcasts it to the current room as a fallback. |

On Linux, the main loop registers sockets with `epoll` using edge triggering
and `EPOLLONESHOT`, dispatches read work to an eight-worker pool, then rearms
the descriptor. A background worker checks every 15 seconds and closes clients
whose last incoming data is older than 30 seconds. `SIGINT` and `SIGTERM` stop
the main loop.

## 10. Configuration and local operation

No `.env.example` is included. Create `backend/.env` (or provide equivalent
process environment variables) with at least:

```dotenv
PORT=3000
MONGO_URI=mongodb://...
JWT_SECRET=long-random-secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
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

Vite defaults to port 5173; Express is expected on port 3000. In production,
`npm run build --prefix frontend` produces `frontend/dist`, then the Express
server serves it and falls back to `index.html` for client-side routes.

## 11. Implementation notes and gaps for maintainers

These are observations of the current code, not assumed future behavior:

- The C++ engine, Redis adapter, and Socket.IO integration are separate pieces.
  Redis is only enabled when `REDIS_URL` exists; the C++ engine is never used
  by the JavaScript application.
- With multiple Node processes, `userSocketMap` remains process-local. Redis
  shares Socket.IO broadcasts, but `sendMessage` decides whether to emit at all
  using that local map. A recipient connected to a different instance may be
  missed and not have the message automatically marked delivered.
- The C++ Linux reader performs one `recv` per edge-triggered readiness event.
  Correct edge-triggered use normally drains until `EAGAIN`; under heavy input,
  remaining bytes may not generate another event. Its Windows `select` branch
  also only watches the listening socket, not established clients.
- Frontend mobile responsiveness is limited: the chat page keeps its fixed
  sidebar instead of defining a small-screen navigation behavior.
- There are no automated tests, environment template, CI configuration, or
  API specification in the repository.
- `login.png` and `signup.png` are unused, and the default Vite title/icon were
  not replaced.
- The current worktree already has modified backend and frontend lockfiles;
  this report does not alter them.

## 12. Best starting points for a new contributor

1. Read `frontend/src/App.jsx`, then the two Zustand stores. They reveal route
   protection, REST calls, socket setup, and UI state.
2. Read `backend/src/server.js`, route files, controllers, then `lib/socket.js`
   to follow the server flow end-to-end.
3. Use `Message.js` and `User.js` to understand persistence and indexes.
4. Treat `cpp_core/` as a separate prototype/service until a concrete bridge
   contract is implemented.
5. Before production work, add an environment template, test coverage, a real
   deployment configuration, and an explicit decision on whether the C++ core
   is part of the shipped system.
