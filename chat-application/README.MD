<h1 align="center">⚡ Scalable Hybrid Chat Architecture ⚡</h1>
<p align="center">
  <b>High-Concurrency C++ Core Engine • Node.js Microservices • Socket.io Redis Cluster</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/C%2B%2B17-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
</p>

---

## 📖 Overview

This repository houses a production-grade, real-time chat platform that bridges the gap between low-level systems programming and modern web microservices. 

Instead of relying solely on a standard Node.js backend, this project offloads heavy, concurrent TCP network I/O to a custom-built **C++ Engine** utilizing multiplexing and thread pools. The C++ core communicates with a horizontally scaled **Node.js Gateway** via Redis, ensuring high throughput, exact message framing, and seamless delivery status lifecycles.

---

## 🌟 Key Architecture & Technical Highlights

### ⚡ 1. Low-Level C++ Performance Engine (`/cpp_core`)
- **Event-Driven I/O Multiplexing**: Utilizes non-blocking edge-triggered `epoll` (Linux) and `select`/`WSAPoll` (Windows) to solve the C10K problem.
- **Fixed-Size Thread Pool**: Task queue driven by `std::thread`, `std::mutex`, and `std::condition_variable`, eliminating per-connection stack allocation overhead.
- **Custom TCP Packet Framing**: Implements a strict 4-byte big-endian header length prefix protocol. Thread-safe buffer mutations prevent TCP sticky bytes, partial reads, and data corruption.
- **Memory Safety & Heartbeats**: Includes a 15s ping / 30s timeout sweep to purge dead connections and handles `SIGINT`/`SIGTERM` to gracefully release file descriptors.

### 🔄 2. Node.js & Redis Socket Layer (`/backend`)
- **Horizontal Scalability**: Uses `@socket.io/redis-adapter` and `ioredis` to synchronize state and broadcast events across multiple Node.js instances.
- **Strict Delivery Lifecycle**: Database-backed Message ACKs preventing state regressions (`sent` ➔ `delivered` ➔ `read`).
- **High-Performance Pagination**: Implements cursor-based infinite scrolling, powered by a compound MongoDB index `{ senderId: 1, receiverId: 1, createdAt: -1 }`.

### 🛡️ 3. Frontend & Security (`/frontend`)
- **Optimistic UI Updates**: Zustand functional state updates prevent stale closures and dropped socket events during asynchronous API calls.
- **Security**: Custom JWT Auth (HttpOnly cookies), Arcjet API rate-limiting, and secure routing.
- **Tech Stack**: React 19, Tailwind CSS, DaisyUI, Cloudinary (Media Uploads).

---

## 🏗 System Architecture Diagram

```text
                              +---------------------------------------+
                              |            React Frontend             |
                              +---------------------------------------+
                                           |            ^
                       WebSockets (Socket.io)  REST & File Uploads
                                           v            |
                              +---------------------------------------+
                              |         Node.js Express Server        |
                              |         (Auth, DB, Socket.io)         |
                              +---------------------------------------+
                                   |                    |
                     Redis Adapter |                    |
                     (Pub/Sub)     v                    v
                         +-------------------+  +--------------+
                         | Redis Broker      |  | MongoDB      |
                         | (Cross-node sync) |  | (ACK Status) |
                         +-------------------+  +--------------+
                                   ^
                                   | (TCP Custom Binary Framing: 4-byte Prefix)
                                   v
                              +---------------------------------------+
                              |       C++ High-Performance Engine     |
                              | (Multiplexing, Thread Pool,           |
                              |  Thread-safe Room Maps, Heartbeats)   |
                              +---------------------------------------+