import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// ---------------------------------------------------------------------------
// Redis client setup (shared across adapter + presence)
// ---------------------------------------------------------------------------
let redisClient = null;

if (ENV.REDIS_URL) {
  try {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { Redis } = await import("ioredis");

    const pubClient = new Redis(ENV.REDIS_URL);
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    console.log("--> Socket.io Redis Adapter successfully connected for multi-node horizontal scaling.");

    // Reuse pubClient for presence commands (avoids a third connection)
    redisClient = pubClient;
    console.log("--> Redis presence tracking enabled.");
  } catch (err) {
    console.warn("--> Redis adapter setup skipped or failed, running in single-instance mode:", err.message);
  }
}

io.use(socketAuthMiddleware);

// ---------------------------------------------------------------------------
// Presence tracking
//
// When Redis is available:
//   - Redis Set  "presence:{userId}"       → set of socketIds across all nodes
//   - Redis Set  "presence:all_users"      → set of userIds currently online
//   Queries are cross-instance and consistent.
//
// When Redis is NOT available (single-instance fallback):
//   - In-memory `userSocketMap` object (original behaviour).
// ---------------------------------------------------------------------------
const PRESENCE_KEY_PREFIX = "presence:";
const ALL_USERS_KEY = "presence:all_users";

// In-memory fallback (used when REDIS_URL is unset)
const userSocketMap = {}; // { userId: Set<socketId> }

// ---- Write helpers ----

async function addPresence(userId, socketId) {
  if (redisClient) {
    const userKey = `${PRESENCE_KEY_PREFIX}${userId}`;
    await redisClient.sadd(userKey, socketId);
    await redisClient.sadd(ALL_USERS_KEY, userId);
  } else {
    if (!userSocketMap[userId]) {
      userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socketId);
  }
}

async function removePresence(userId, socketId) {
  if (redisClient) {
    const userKey = `${PRESENCE_KEY_PREFIX}${userId}`;
    await redisClient.srem(userKey, socketId);
    const remaining = await redisClient.scard(userKey);
    if (remaining === 0) {
      await redisClient.srem(ALL_USERS_KEY, userId);
      await redisClient.del(userKey);
    }
  } else {
    if (userSocketMap[userId]) {
      userSocketMap[userId].delete(socketId);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    }
  }
}

// ---- Read helpers (exported) ----

/**
 * Returns true if `userId` has at least one active socket (across all nodes).
 */
export async function isUserOnline(userId) {
  if (redisClient) {
    return await redisClient.sismember(ALL_USERS_KEY, userId.toString()) === 1;
  }
  const sockets = userSocketMap[userId];
  return !!(sockets && sockets.size > 0);
}

/**
 * Returns the list of all online userIds (across all nodes).
 */
export async function getOnlineUserIds() {
  if (redisClient) {
    return await redisClient.smembers(ALL_USERS_KEY);
  }
  return Object.keys(userSocketMap).filter((id) => userSocketMap[id].size > 0);
}

/**
 * Returns socket IDs for `userId` on THIS process only.
 * Useful for local operations; for cross-instance delivery use io.to(`user:${id}`).
 */
export function getReceiverSocketId(userId) {
  const sockets = userSocketMap[userId];
  if (sockets && sockets.size > 0) {
    return Array.from(sockets)[0]; // Return primary socket ID
  }
  return null;
}

/**
 * Returns socket IDs for `userId` on THIS process only.
 */
export function getUserSocketIds(userId) {
  const sockets = userSocketMap[userId];
  return sockets ? Array.from(sockets) : [];
}

// ---------------------------------------------------------------------------
// Broadcast online user list to all clients
// ---------------------------------------------------------------------------
async function broadcastOnlineUsers() {
  try {
    const onlineUsers = await getOnlineUserIds();
    io.emit("getOnlineUsers", onlineUsers);
  } catch (err) {
    console.error("Error broadcasting online users:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------
io.on("connection", async (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${socket.user.fullName} (${userId}) [Socket: ${socket.id}]`);

  // Always track locally (needed for local getUserSocketIds fallback)
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = new Set();
  }
  userSocketMap[userId].add(socket.id);

  // Track in Redis (if available)
  await addPresence(userId, socket.id);

  // Broadcast online users status (reads from Redis when available)
  await broadcastOnlineUsers();

  // 1. Join user room for targeted socket events
  socket.join(`user:${userId}`);

  // 3. Event: Recipient opens chat window (Read Receipt)
  socket.on("messageRead", async ({ senderId }) => {
    try {
      const now = new Date();
      const result = await Message.updateMany(
        { senderId: senderId, receiverId: userId, status: { $ne: "read" } },
        { $set: { status: "read", readAt: now } }
      );

      if (result.modifiedCount > 0) {
        io.to(`user:${senderId}`).emit("messagesMarkedRead", {
          readBy: userId,
          readAt: now,
        });
      }
    } catch (err) {
      console.error("Error updating message read status:", err.message);
    }
  });

  // 4. Typing indicators — relay to recipient's room (Redis adapter routes cross-instance)
  socket.on("typing",     ({ receiverId }) => io.to(`user:${receiverId}`).emit("typing",     { senderId: userId }));
  socket.on("stopTyping", ({ receiverId }) => io.to(`user:${receiverId}`).emit("stopTyping", { senderId: userId }));

  // Disconnect handler
  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${socket.user.fullName} [Socket: ${socket.id}]`);

    // Remove from local map
    if (userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    }

    // Remove from Redis (if available)
    await removePresence(userId, socket.id);

    await broadcastOnlineUsers();
  });
});

export { io, app, server };