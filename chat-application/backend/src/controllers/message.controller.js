import cloudinary from "../lib/cloudinary.js";
import { isUserOnline, io } from "../lib/socket.js";
import { logger } from "../lib/logger.js";
import { messagesSentCounter } from "../lib/metrics.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
      isEmailVerified: true,
    }).select("_id fullName email profilePic publicKey");

    res.status(200).json(filteredUsers);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in getAllContacts");
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Cursor-based pagination for chat history reads using compound index
 */
export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;
    const { cursor } = req.query;
    const requestedLimit = req.query.limit ?? "50";
    const limit = Number(requestedLimit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: "Limit must be an integer between 1 and 100" });
    }

    const query = {
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    };

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (Number.isNaN(cursorDate.getTime())) {
        return res.status(400).json({ message: "Invalid pagination cursor" });
      }
      query.createdAt = { $lt: cursorDate };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json(messages.reverse());
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in getMessages controller");
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, encryptedText, iv } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // Validate: encryptedText and iv must always come together
    if (encryptedText && !iv) {
      return res.status(400).json({ message: "iv is required when encryptedText is provided." });
    }
    if (iv && !encryptedText) {
      return res.status(400).json({ message: "encryptedText is required when iv is provided." });
    }

    const isEncrypted = Boolean(encryptedText);
    const normalizedText = typeof text === "string" ? text.trim() : "";

    // At least one of: encrypted content, plaintext, or image must be present
    if (!isEncrypted && !normalizedText && !image) {
      return res.status(400).json({ message: "Text or image is required." });
    }
    if (image && typeof image !== "string") {
      return res.status(400).json({ message: "Image must be a valid string payload." });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    // Immediate Sent ACK status creation
    const newMessage = new Message({
      senderId,
      receiverId,
      // Store ciphertext when encrypted; otherwise store plaintext (backward compat)
      ...(isEncrypted
        ? { encryptedText, iv }
        : { text: normalizedText }),
      image: imageUrl,
      status: "sent",
    });

    await newMessage.save();
    messagesSentCounter.inc();

    // Check if receiver is online (across all instances via Redis when available)
    const receiverOnline = await isUserOnline(receiverId);
    if (receiverOnline) {
      newMessage.status = "delivered";
      newMessage.deliveredAt = new Date();
      await newMessage.save();
    }

    // Emit to receiver's user room (Redis adapter routes cross-instance)
    if (receiverOnline) {
      io.to(`user:${receiverId}`).emit("newMessage", newMessage);
    }
    // Also emit to sender's user room for multi-device / multi-tab synchronization
    io.to(`user:${senderId}`).emit("newMessage", newMessage);

    res.status(201).json({
      ack: true,
      message: newMessage,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in sendMessage controller");
    res.status(500).json({ message: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user._id;

    const now = new Date();
    await Message.updateMany(
      { senderId, receiverId, status: { $ne: "read" } },
      { $set: { status: "read", readAt: now } }
    );

    io.to(`user:${senderId}`).emit("messagesMarkedRead", {
      readBy: receiverId,
      readAt: now,
    });

    res.status(200).json({ success: true, readAt: now });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in markMessagesAsRead");
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    /**
     * Single aggregation pipeline:
     * 1. Match every message the user sent or received.
     * 2. Derive the other participant as `partnerId`.
     * 3. Sort all messages newest-first so $first inside $group gives the latest.
     * 4. Group by partnerId — one document per conversation with the latest message.
     *    Tracks whether the last message was E2EE (encryptedText present).
     * 5. Re-sort the per-conversation documents by most recent activity.
     * 6. $lookup partner user documents (excludes sensitive fields via $project).
     * 7. Project a flat object with user fields + last-message metadata.
     *    For encrypted conversations, lastMessageText is not returned (server never
     *    stores plaintext); instead an isEncrypted flag is set so the UI can
     *    render "🔒 Encrypted message" in place of a snippet.
     */
    const partners = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
        },
      },
      {
        $addFields: {
          partnerId: {
            $cond: [{ $eq: ["$senderId", loggedInUserId] }, "$receiverId", "$senderId"],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id:                    "$partnerId",
          lastMessageText:        { $first: "$text" },
          lastMessageEncryptedText: { $first: "$encryptedText" },
          lastMessageIv:          { $first: "$iv" },
          lastMessageImage:       { $first: "$image" },
          lastMessageAt:          { $first: "$createdAt" },
          lastMessageSenderId:    { $first: "$senderId" },
          // Track whether the most recent message is encrypted
          lastMessageEncrypted:   { $first: { $cond: [{ $gt: ["$encryptedText", null] }, true, false] } },
        },
      },
      { $sort: { lastMessageAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id:                 "$user._id",
          fullName:            "$user.fullName",
          email:               "$user.email",
          profilePic:          "$user.profilePic",
          publicKey:           "$user.publicKey",
          // Only expose plaintext snippet for non-encrypted messages
          lastMessageText: {
            $cond: ["$lastMessageEncrypted", "$$REMOVE", "$lastMessageText"],
          },
          lastMessageEncryptedText: 1,
          lastMessageIv:       1,
          lastMessageImage:    1,
          lastMessageAt:       1,
          lastMessageSenderId: 1,
          isEncrypted:         "$lastMessageEncrypted",
        },
      },
    ]);

    res.status(200).json(partners);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in getChatPartners");
    res.status(500).json({ message: "Internal server error" });
  }
};
