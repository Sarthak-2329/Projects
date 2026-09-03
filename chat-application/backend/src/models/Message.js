import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Required for 1:1 direct messages, omitted for group conversations
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return !this.conversationId;
      },
    },
    // Set for group chat messages
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    // E2EE fields — present only on encrypted DM text messages.
    // The server stores and relays these blobs without ever seeing plaintext.
    encryptedText: {
      type: String, // base64-encoded AES-256-GCM ciphertext
      maxlength: 8000,
    },
    iv: {
      type: String, // base64-encoded 12-byte random IV
      maxlength: 32,
    },
    image: {
      type: String,
    },
    // Direct message delivery lifecycle status
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Track read receipts for group conversations
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Compound indexes for fast cursor-based pagination per conversation timeline
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, status: 1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;