<h1 align="center">⚡ Production Hybrid AI Chat Platform ⚡</h1>
<p align="center">
  <b>High-Concurrency C++ Core Engine • Node.js Microservices • Socket.io Redis Cluster • RAG Document AI Streaming</b>
</p>

---

## 🌟 Key Architecture & Technical Highlights

### ⚡ 1. Low-Level C++ Performance Engine (`/cpp_core`)
- **`epoll` I/O Multiplexing**: Linux non-blocking event-driven socket server (with cross-platform Winsock `WSAPoll` fallback for Windows development).
- **Fixed-Size Thread Pool**: Multi-threaded worker queue (`std::thread`, `std::mutex`, `std::condition_variable`) eliminating task allocation overhead under high connection surges.
- **Thread-Safe State & Heartbeats**: Mutex-protected room maps (`std::lock_guard`) with a periodic **15s Heartbeat Ping / 30s Timeout** sweep to purge zombie sockets.
- **Custom TCP Packet Framing**: 4-byte big-endian header length prefix protocol parser resolving sticky bytes and partial buffer reads.
- **Signal Trapping & Memory Safety**: Handles `SIGINT` / `SIGTERM` to close file descriptors cleanly and prevent resource leaks.

### 🔄 2. Real-Time Socket Layer & Delivery Receipts (`/backend`)
- **Redis Pub/Sub Adapter**: `@socket.io/redis-adapter` and `ioredis` integration enabling multi-instance Node.js process clustering.
- **Message ACK Lifecycle**: Database-backed status tracking (`sent` ➔ `delivered` ➔ `read`) with `deliveredAt` and `readAt` timestamps.
- **Cursor-Based Pagination**: Compound MongoDB indexing `{ senderId: 1, receiverId: 1, createdAt: -1 }` for high-performance conversation timeline reads.

### 🤖 3. AI Agent & RAG Document Streaming (`/backend/src/ai`)
- **RAG Document Engine**: Parses document text, chunks content into overlapping segments (500 chars / 100 overlap), and stores vector representations.
- **Similarity Search**: Cosine Similarity nearest-neighbor search for retrieving contextual prompt grounding.
- **Real-Time Token Streaming**: Stream AI response tokens directly to chat clients over WebSockets (`aiToken` ➔ `aiDone`).

### 🛡️ 4. Full-Stack Features & Security
- 🔐 **Custom JWT Authentication** (HttpOnly cookie validation & socket auth middleware)
- 🟢 **Presence Indicators & Sound Alerts** (Online/offline user tracking & customizable audio notifications)
- 📨 **Welcome Emails** powered by Resend
- 🗂️ **Cloudinary Media Uploads** for high-resolution images
- 🚦 **Arcjet API Rate-Limiting & Security**
- 🎨 **React 19, Zustand, Tailwind CSS & DaisyUI**

---

## 🏗 System Architecture Diagram

```
                              +---------------------------------------+
                              |            React Frontend             |
                              +---------------------------------------+
                                           |           ^
                           WebSockets (Socket.io)  REST & File Uploads
                                           v           |
                              +---------------------------------------+
                              |         Node.js Express Server        |
                              |        (Auth, DB, Socket.io)          |
                              +---------------------------------------+
                                   |                     |          |
                    Redis Adapter  |                     |          |  AI RAG API & Stream
                    (Pub/Sub)      v                     v          v
                         +-------------------+  +--------------+  +--------------------+
                         | Redis Broker      |  | MongoDB      |  | AI Vector Store    |
                         | (Cross-node sync) |  | (ACK Status) |  | (PDF RAG Search)   |
                         +-------------------+  +--------------+  +--------------------+
                                   ^
                                   | (TCP Custom Binary Framing: 4-byte Prefix)
                                   v
                              +---------------------------------------+
                              |       C++ High-Performance Engine     |
                              | (epoll Multiplexing, Thread Pool,     |
                              |  Thread-safe Room Maps, Heartbeats)   |
                              +---------------------------------------+
```

---

## 🧪 Environment Setup (`.env`)

Create a `.env` file in the `/backend` directory:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string

NODE_ENV=development
JWT_SECRET=your_jwt_secret_key

CLIENT_URL=http://localhost:5173

# Optional: Redis Cluster URL for horizontal Socket.io scaling
REDIS_URL=redis://localhost:6379

# Email Service
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=your_verified_email@domain.com
EMAIL_FROM_NAME=YourAppName

# Cloudinary Setup
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Security & Rate Limiting
ARCJET_KEY=your_arcjet_key
ARCJET_ENV=development
```

---

## 🚀 Getting Started

### 1. Run the C++ Core Engine

#### Option A: Direct GCC Compilation / NPM Script
```bash
# Via Root npm script
npm run build:cpp

# Direct GCC Compilation
g++ -std=c++17 cpp_core/src/main.cpp cpp_core/src/socket_engine.cpp cpp_core/src/room_manager.cpp -Icpp_core/include -lws2_32 -o cpp_core/cpp_chat_core

# Run Server on Port 8080
./cpp_core/cpp_chat_core 8080
```

#### Option B: CMake Build
```bash
cd cpp_core
mkdir build && cd build
cmake ..
make
./cpp_chat_core 8080
```

---

### 2. Run the Node.js Backend

```bash
cd backend
npm install
npm run dev
```

---

### 3. Run the React Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 📡 API & Socket Event Reference

### Message ACKs & Real-Time Status Events
| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `messageDelivered` | Client ➔ Server | `{ messageId, senderId }` — Updates DB to `delivered` status. |
| `messageStatusUpdated` | Server ➔ Sender | `{ messageId, status: "delivered", deliveredAt }` |
| `messageRead` | Client ➔ Server | `{ senderId }` — Bulk updates unread room messages to `read`. |
| `messagesMarkedRead` | Server ➔ Sender | `{ readBy, readAt }` |

### AI RAG Stream Events
| Event / Endpoint | Type | Description |
| :--- | :--- | :--- |
| `POST /api/ai/upload-doc` | REST | Uploads & indexes document chunks into the Vector Store. |
| `POST /api/ai/query` | REST / Socket | Queries document vector store & streams AI tokens over socket (`aiToken` ➔ `aiDone`). |