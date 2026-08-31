<h1 align="center">⚡ Scalable Real-Time Chat Application ⚡</h1>
<p align="center">
  <b>Node.js Microservices • Socket.io with Redis Horizontal Scaling • Standalone C++ Networking Engine</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/C%2B%2B17-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
</p>

---

## 📖 Overview

A production-grade, real-time one-to-one chat platform with a **React 19 frontend**, a **Node.js/Express/Socket.io backend** with MongoDB persistence, and an optional **Redis adapter for horizontal scaling** across multiple Node instances.

The repository also contains a standalone **C++ TCP chat engine** (`/cpp_core`) — a separate systems-programming project that demonstrates high-concurrency networking from scratch. It is **not connected** to the web application; they are independent components.

---

## 🌟 Key Architecture & Technical Highlights

### 🔄 1. Node.js & Socket.io Backend (`/backend`)
- **Horizontal Scalability**: Uses `@socket.io/redis-adapter` and `ioredis` to synchronize broadcasts and presence across multiple Node.js instances (optional — falls back to single-instance mode when `REDIS_URL` is unset).
- **Strict Delivery Lifecycle**: Database-backed message ACKs preventing state regressions (`sent` ➔ `delivered` ➔ `read`), with real-time delivery and read receipts over Socket.io.
- **High-Performance Pagination**: Cursor-based infinite scrolling powered by a compound MongoDB index `{ senderId: 1, receiverId: 1, createdAt: -1 }`.
- **Security**: JWT authentication (HttpOnly cookies), Arcjet API rate-limiting and bot detection, and protected routes.

### 🛡️ 2. Frontend (`/frontend`)
- **Optimistic UI Updates**: Zustand functional state updates prevent stale closures and dropped socket events during asynchronous API calls.
- **Tech Stack**: React 19, Tailwind CSS, DaisyUI, Cloudinary (media uploads).

### ⚡ 3. Standalone C++ Networking Engine (`/cpp_core`)
A separate, self-contained TCP chat server built from scratch to demonstrate low-level systems programming concepts. It is **not integrated** with the web application above — it runs independently with its own protocol and in-memory state.

- **Event-Driven I/O Multiplexing**: Non-blocking edge-triggered `epoll` (Linux) with `select`/`WSAPoll` fallback (Windows).
- **Buffered Non-Blocking Writes**: Per-socket outbound queues with `EPOLLOUT` handling prevent slow clients from corrupting or dropping frames.
- **Custom TCP Packet Framing**: 4-byte big-endian length-prefix protocol with thread-safe buffer accumulation to handle partial reads and TCP coalescing.
- **Heartbeat & Cleanup**: 15s ping / 30s timeout sweep to purge dead connections; graceful `SIGINT`/`SIGTERM` shutdown.

---

## 🏗 System Architecture

### Web Application (what users interact with)

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

### C++ Engine (independent systems demo)

```text
                          +---------------------------------------+
                          |       C++ TCP Chat Server (:8080)     |
                          | (epoll, Buffered Writes, Binary Framing,|
                          |  In-Memory RoomManager, Heartbeats)   |
                          +---------------------------------------+
                                       ^
                                       | Raw TCP (4-byte length prefix)
                                       v
                              Any TCP client (telnet, netcat, custom)
```

> **Note:** These two systems are independent. The C++ engine demonstrates the same
> networking concepts (multiplexing, rooms, heartbeats) that Socket.io provides
> out of the box, implemented manually at the systems level as a learning exercise.

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- MongoDB instance
- Redis (optional — enables horizontal scaling)
- CMake ≥ 3.14 + C++17 compiler (only for the C++ engine)

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

### C++ Engine (standalone)

```bash
npm run build:cpp                      # CMake configure + build
npm run start:cpp                      # Run on default port 8080
# or: ./cpp_core/build/cpp_chat_core 9090
```
