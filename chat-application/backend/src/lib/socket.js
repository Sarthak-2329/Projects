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

// Setup Redis Adapter for multi-instance scaling if REDIS_URL is provided
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { Redis } = await import("ioredis");
    
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    console.log("--> Socket.io Redis Adapter successfully connected for multi-node horizontal scaling.");
  } catch (err) {
    console.warn("--> Redis adapter setup skipped or failed, running in single-instance mode:", err.message);
  }
}

io.use(socketAuthMiddleware);

const userSocketMap = {}; // { userId: Set of socketIds }

export function getReceiverSocketId(userId) {
  const sockets = userSocketMap[userId];
  if (sockets && sockets.size > 0) {
    return Array.from(sockets)[0]; // Return primary socket ID
  }
  return null;
}

export function getUserSocketIds(userId) {
  const sockets = userSocketMap[userId];
  return sockets ? Array.from(sockets) : [];
}

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${socket.user.fullName} (${userId}) [Socket: ${socket.id}]`);

  if (!userSocketMap[userId]) {
    userSocketMap[userId] = new Set();
  }
  userSocketMap[userId].add(socket.id);

  // Broadcast online users status
  io.emit("getOnlineUsers", Object.keys(userSocketMap).filter(id => userSocketMap[id].size > 0));

  // 1. Join user room for targeted socket events
  socket.join(`user:${userId}`);

  // 2. Event: Recipient acknowledges delivery receipt
  socket.on("messageDelivered", async ({ messageId, senderId }) => {
    try {
      const updatedMessage = await Message.findOneAndUpdate(
        { _id: messageId, status: { $ne: "read" } },
        { status: "delivered", deliveredAt: new Date() },
        { new: true }
      );
      if (updatedMessage) {
        io.to(`user:${senderId}`).emit("messageStatusUpdated", {
          messageId: updatedMessage._id,
          status: "delivered",
          deliveredAt: updatedMessage.deliveredAt,
        });
      }
    } catch (err) {
      console.error("Error updating message delivery status:", err.message);
    }
  });

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

  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.user.fullName} [Socket: ${socket.id}]`);
    if (userSocketMap[userId]) {
      userSocketMap[userId].delete(socket.id);
      if (userSocketMap[userId].size === 0) {
        delete userSocketMap[userId];
      }
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap).filter(id => userSocketMap[id].size > 0));
  });
});

export { io, app, server };