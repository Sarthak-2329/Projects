# Performance & Load Testing Benchmarks

This document records real load testing and throughput benchmarks measured using [k6](https://k6.io) against the chat application backend.

> [!NOTE]
> **Test Environment & Hardware Context**  
> These benchmarks were executed locally in a Linux x86_64 containerized sandbox environment on a single Node.js runtime process using an in-memory MongoDB instance (`mongodb-memory-server`) and in-memory Socket.io presence.
> 
> Real-world production performance will vary based on hardware specifications, dedicated MongoDB/Redis clustering, network topology, and horizontal scaling across multiple Node instances.

---

## 🎯 Test Methodology

The load test script ([`backend/loadtest/chat-flow.js`](file:///home/sarthak-surale/Documents/Programming/Projects/chat-application/backend/loadtest/chat-flow.js)) models realistic end-to-end user behavior rather than simple synthetic endpoint pinging:

1. **Authentication**: Virtual users (VUs) log in via `POST /api/auth/login` and receive session JWT cookies.
2. **Contact Discovery**: VUs fetch their contact list via `GET /api/messages/contacts`.
3. **Chat History**: VUs request recent conversation history with a selected peer via `GET /api/messages/:id?limit=20`.
4. **Message Dispatch**: VUs compose and send a real message via `POST /api/messages/send/:id` and verify the server acknowledgement (`ack: true`).
5. **Real-Time WebSocket Session**: VUs establish and hold an active Socket.io WebSocket connection (`/socket.io/?EIO=4&transport=websocket`), handle Engine.io heartbeats (ping/pong), and process inbound real-time events.

---

## 📊 Benchmark Results

### 1. Concurrency Level: 50 Virtual Users (30-second duration)

| Metric | Measured Value |
| :--- | :--- |
| **Concurrent Virtual Users (VUs)** | 50 VUs |
| **Completed User Iterations** | 460 flows |
| **Iteration Throughput** | 14.59 flows/sec |
| **Total HTTP Requests** | 1,840 requests |
| **HTTP Request Throughput** | **58.37 req/sec** |
| **HTTP Error Rate** | **0.00%** (0 / 1,840 failed) |
| **Message Delivery Success Rate** | **100.00%** (460 / 460 with ACK) |
| **HTTP Latency — Median (p50)** | **398.14 ms** |
| **HTTP Latency — 90th Percentile (p90)** | **576.33 ms** |
| **HTTP Latency — 95th Percentile (p95)** | **621.73 ms** |
| **Message Send Latency (p50 / p95)** | **363.00 ms / 551.05 ms** |
| **WebSocket Real-Time Messages Received** | 22,064 events (699.87 msgs/sec) |
| **All Assertion Checks Passed** | **100.00%** (2,760 / 2,760 checks) |

---

### 2. Concurrency Level: 200 Virtual Users (30-second duration)

| Metric | Measured Value |
| :--- | :--- |
| **Concurrent Virtual Users (VUs)** | 200 VUs |
| **Completed User Iterations** | 614 flows |
| **Iteration Throughput** | 17.30 flows/sec |
| **Total HTTP Requests** | 2,450 requests |
| **HTTP Request Throughput** | **69.02 req/sec** |
| **HTTP Error Rate** | **0.08%** (2 TCP resets / 2,450 requests) |
| **Message Delivery Success Rate** | **100.00%** (612 / 612 with ACK) |
| **HTTP Latency — Median (p50)** | **1,509.00 ms** |
| **HTTP Latency — 90th Percentile (p90)** | **2,754.09 ms** |
| **HTTP Latency — 95th Percentile (p95)** | **5,341.62 ms** |
| **Message Send Latency (p50 / p95)** | **1,079.00 ms / 2,039.00 ms** |
| **WebSocket Real-Time Messages Received** | 113,841 events (3,207.25 msgs/sec) |
| **All Assertion Checks Passed** | **99.95%** (3,672 / 3,674 checks) |

---

## 🛠️ How to Reproduce

You can run the benchmark suite against the local backend using the bundled runner:

```bash
# Execute automated load tests across 50 and 200 concurrent VUs
node backend/loadtest/runner.js
```
