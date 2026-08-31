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
const PRESENCE_TTL_SECONDS = 60;
const removeStalePresenceScript = `
  if redis.call('SCARD', KEYS[1]) == 0 then
    return redis.call('SREM', KEYS[2], ARGV[1])
  end
  return 0
`;

// In-memory fallback (used when REDIS_URL is unset)
const userSocketMap = {}; // { userId: Set<socketId> }

// ---- Write helpers ----

async function addPresence(userId, socketId) {
  if (redisClient) {
    const userKey = `${PRESENCE_KEY_PREFIX}${userId}`;
    await redisClient
      .multi()
      .sadd(userKey, socketId)
      .expire(userKey, PRESENCE_TTL_SECONDS)
      .sadd(ALL_USERS_KEY, userId)
      .expire(ALL_USERS_KEY, PRESENCE_TTL_SECONDS)
      .exec();
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
    // Remove the user from the aggregate set only if another process has not
    // added a new socket in the meantime.
    await redisClient.eval(removeStalePresenceScript, 2, userKey, ALL_USERS_KEY, userId.toString());
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
    try {
      const userKey = `${PRESENCE_KEY_PREFIX}${userId}`;
      return await redisClient.scard(userKey) > 0;
    } catch (err) {
      console.warn("Redis presence lookup failed; using local presence:", err.message);
    }
  }
  const sockets = userSocketMap[userId];
  return !!(sockets && sockets.size > 0);
}

/**
 * Returns the list of all online userIds (across all nodes).
 */
export async function getOnlineUserIds() {
  if (redisClient) {
    try {
      const userIds = await redisClient.smembers(ALL_USERS_KEY);
      const onlineChecks = await Promise.all(
        userIds.map(async (userId) => ({
          userId,
          online: await redisClient.scard(`${PRESENCE_KEY_PREFIX}${userId}`) > 0,
        }))
      );
      const staleUserIds = onlineChecks.filter(({ online }) => !online).map(({ userId }) => userId);
      await Promise.all(staleUserIds.map((userId) => redisClient.eval(
        removeStalePresenceScript,
        2,
        `${PRESENCE_KEY_PREFIX}${userId}`,
        ALL_USERS_KEY,
        userId
      )));
      return onlineChecks.filter(({ online }) => online).map(({ userId }) => userId);
    } catch (err) {
      console.warn("Redis online-user lookup failed; using local presence:", err.message);
    }
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

async function refreshLocalPresence() {
  if (!redisClient) return;

  try {
    const pipeline = redisClient.multi();
    for (const [userId, sockets] of Object.entries(userSocketMap)) {
      if (sockets.size === 0) continue;
      const userKey = `${PRESENCE_KEY_PREFIX}${userId}`;
      pipeline.expire(userKey, PRESENCE_TTL_SECONDS);
      pipeline.sadd(ALL_USERS_KEY, userId);
    }
    pipeline.expire(ALL_USERS_KEY, PRESENCE_TTL_SECONDS);
    await pipeline.exec();
  } catch (err) {
    console.warn("Redis presence refresh failed:", err.message);
  }
}

const presenceRefreshTimer = setInterval(refreshLocalPresence, (PRESENCE_TTL_SECONDS * 1000) / 2);
presenceRefreshTimer.unref();

async function markPendingMessagesDelivered(receiverId) {
  const pendingMessages = await Message.find({ receiverId, status: "sent" }).select("_id senderId");
  if (pendingMessages.length === 0) return;

  const deliveredAt = new Date();
  await Message.updateMany(
    { _id: { $in: pendingMessages.map((message) => message._id) }, status: "sent" },
    { $set: { status: "delivered", deliveredAt } }
  );

  for (const message of pendingMessages) {
    io.to(`user:${message.senderId}`).emit("messageStatusUpdated", {
      messageId: message._id.toString(),
      status: "delivered",
      deliveredAt,
    });
  }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------
io.on("connection", async (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${socket.user.fullName} (${userId}) [Socket: ${socket.id}]`);

  // Join before announcing presence. This closes the race where a sender sees
  // the recipient as online but its event is emitted before this socket joins.
  socket.join(`user:${userId}`);

  // Always track locally (needed for local getUserSocketIds fallback)
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = new Set();
  }
  userSocketMap[userId].add(socket.id);

  try {
    await addPresence(userId, socket.id);
    await markPendingMessagesDelivered(userId);
    await broadcastOnlineUsers();
  } catch (err) {
    console.error("Error finalizing socket connection:", err.message);
  }

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
    try {
      await removePresence(userId, socket.id);
      await broadcastOnlineUsers();
    } catch (err) {
      console.error("Error finalizing socket disconnect:", err.message);
    }
  });
});

export { io, app, server };
