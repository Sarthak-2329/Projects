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
