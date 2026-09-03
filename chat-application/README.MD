<h1 align="center">⚡ Scalable Real-Time Chat Application ⚡</h1>
<p align="center">
  <b>Node.js Microservices • Socket.io with Redis Horizontal Scaling • React 19 Frontend</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
</p>

---

## 📖 Overview

A production-grade, real-time one-to-one chat platform with a **React 19 frontend**, a **Node.js/Express/Socket.io backend** with MongoDB persistence, and an optional **Redis adapter for horizontal scaling** across multiple Node instances.

---

## 🌟 Key Architecture & Technical Highlights

### 🔄 1. Node.js & Socket.io Backend (`/backend`)
- **Horizontal Scalability**: Uses `@socket.io/redis-adapter` and `ioredis` to synchronize broadcasts and presence across multiple Node.js instances (optional — falls back to single-instance mode when `REDIS_URL` is unset).
- **Strict Delivery Lifecycle**: Database-backed message ACKs preventing state regressions (`sent` ➔ `delivered` ➔ `read`), with real-time delivery and read receipts over Socket.io.
- **High-Performance Pagination**: Cursor-based infinite scrolling powered by a compound MongoDB index `{ senderId: 1, receiverId: 1, createdAt: -1 }`.
- **Security**: JWT authentication (HttpOnly cookies), Arcjet API rate-limiting and bot detection, and protected routes.

### 🛡️ 2. Frontend (`/frontend`)
- **Optimistic UI Updates**: Zustand functional state updates prevent stale closures and dropped socket events during asynchronous API calls.
- **Tech Stack**: React 19, Tailwind CSS, Cloudinary (media uploads).

### 📈 3. Observability & Performance Benchmarks
- **Production Observability**: Structured JSON logging via `pino`, request duration logging with `pino-http`, health probes at `GET /api/health`, and Prometheus metrics at `GET /metrics`.
- **Verified Load Performance**: Sustains **58.37 req/sec with 0.00% error rate and 100% message delivery ACK** under 50 concurrent virtual users holding active Socket.io sessions. Detailed methodology and 200 VU stress figures are published in [**`BENCHMARKS.md`**](./BENCHMARKS.md).

---

## 🏗 System Architecture

### Web Application

```text
                          +---------------------------------------+
                          |            React Frontend             |
                          |         (Zustand, Socket.io)          |
                          +---------------------------------------+
                                       |            ^
                   WebSockets (Socket.io)  REST & File Uploads
                                       v            |
                          +---------------------------------------+
                          |         Node.js Express Server        |
                          |      (Auth, DB, Socket.io, ACKs)      |
                          +---------------------------------------+
                               |                    |
                 Redis Adapter |                    |
                 (Pub/Sub)     v                    v
                     +-------------------+  +--------------+
                     | Redis             |  | MongoDB      |
                     | (Cross-node sync, |  | (Users, Msgs |
                     |  Presence)        |  |  ACK Status) |
                     +-------------------+  +--------------+
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- MongoDB instance
- Redis (optional — enables horizontal scaling)

### Web Application

```bash
# Install dependencies
npm install --prefix backend
npm install --prefix frontend

# Configure environment
cp backend/.env.example backend/.env   # Edit with your values

# Development
npm run dev --prefix backend           # Express on :3000
npm run dev --prefix frontend          # Vite on :5173

# Production build
npm run build                          # Installs deps + builds frontend
npm start                              # Serves from backend
```

---

## 🔒 End-to-End Encryption (DM Text Messages)

Direct-message **text content** is end-to-end encrypted client-side. The server stores and relays ciphertext only — plaintext never leaves the sender's browser.

### Cryptographic Scheme

| Layer | Algorithm |
|---|---|
| Key exchange | **X25519 ECDH** (via Web Crypto API `SubtleCrypto`) |
| Symmetric encryption | **AES-256-GCM** — authenticated encryption, prevents tampering |
| IV | **12-byte random** per message — no IV reuse |

### How It Works

1. **Key generation** — On first login each client generates an X25519 keypair using `crypto.subtle.generateKey`. The **private key** is stored in the browser's **IndexedDB** (never sent to the server). The **public key** (base64, 44 chars) is published to the server and stored on the `User` document.

2. **Key exchange** — When Alice sends a message to Bob, the client fetches Bob's public key (returned by the contacts/chats API), derives a shared symmetric key via `crypto.subtle.deriveKey` (ECDH), and encrypts the message text with AES-256-GCM.

3. **Storage** — The server stores `{ encryptedText: base64, iv: base64 }` on the `Message` document. The original plaintext `text` field remains empty for encrypted messages.

4. **Decryption** — Bob's client fetches Alice's public key, performs the same ECDH derivation (yielding the identical shared key), and decrypts each message before rendering.

### Current Scope & Known Limitations

> **These are intentional design decisions, not bugs.**

| Limitation | Status |
|---|---|
| 🖼️ **Image encryption** | ❌ Not encrypted — images are uploaded to Cloudinary as-is |
| 👥 **Group message encryption** | ❌ Not encrypted — only 1:1 DMs are encrypted in this pass |
| 📱 **Multi-device key sync** | ❌ Not supported — keys are per-browser. A second device or cleared storage loses access to old messages. This is expected E2EE behaviour. |
| 🔄 **Forward secrecy** | ❌ Not implemented — static per-conversation keys only (no double-ratchet protocol) |
| 🔑 **Key recovery** | ❌ No recovery path — if IndexedDB is cleared, old encrypted messages cannot be decrypted |

### Chat List Preview

Since the server cannot decrypt message content, the sidebar shows **🔒 Encrypted message** in place of a text snippet for encrypted DM conversations.

### Backwards Compatibility

Messages sent before this feature was enabled (stored with a plaintext `text` field and no `encryptedText`) continue to render correctly as plaintext.
