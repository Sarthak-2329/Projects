import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import cloudinary from '../lib/cloudinary.js';
import { io } from '../lib/socket.js';
import { logger } from '../lib/logger.js';
import { messagesSentCounter } from '../lib/metrics.js';

export const createGroup = async (req, res) => {
  try {
    const { name, members: memberIds } = req.body;
    const creatorId = req.user._id;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: 'At least one group member must be specified' });
    }

    // Deduplicate and filter member IDs, ensure creator is included with admin role
    const uniqueMemberIds = Array.from(
      new Set(memberIds.map((id) => id.toString()).filter((id) => id !== creatorId.toString()))
    );

    // Verify all specified members exist and have verified email addresses
    const existingUsers = await User.find({ _id: { $in: uniqueMemberIds }, isEmailVerified: true }).select('_id');
    const validMemberIds = existingUsers.map((u) => u._id);
    const validMemberIdStrings = new Set(validMemberIds.map((id) => id.toString()));

    // Collect skipped IDs so the creator knows who was not added and why
    const skippedMemberIds = uniqueMemberIds.filter((id) => !validMemberIdStrings.has(id.toString()));

    const membersList = [
      { userId: creatorId, role: 'admin', joinedAt: new Date() },
      ...validMemberIds.map((userId) => ({ userId, role: 'member', joinedAt: new Date() })),
    ];

    const newConversation = new Conversation({
      name: name.trim(),
      createdBy: creatorId,
      members: membersList,
    });

    await newConversation.save();

    const populatedConversation = await Conversation.findById(newConversation._id)
      .populate('members.userId', '_id fullName email profilePic')
      .populate('createdBy', '_id fullName email profilePic');

    // Notify all online members to join socket room
    for (const member of membersList) {
      io.to(`user:${member.userId.toString()}`).emit('groupCreated', populatedConversation);
    }

    res.status(201).json({
      ...populatedConversation.toObject(),
      skipped: skippedMemberIds,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    logger.error({ error: error.message }, 'Error in createGroup controller');
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ 'members.userId': userId })
      .populate('members.userId', '_id fullName email profilePic')
      .populate('createdBy', '_id fullName email profilePic')
      .sort({ updatedAt: -1 });

    // Attach latest message preview for each conversation
    const groupsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .populate('senderId', '_id fullName profilePic');

        return {
          ...conv.toObject(),
          lastMessage: lastMessage
            ? {
                _id: lastMessage._id,
                text: lastMessage.text,
                image: lastMessage.image,
                sender: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
              }
            : null,
        };
      })
    );

    res.status(200).json(groupsWithLastMessage);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    logger.error({ error: error.message }, 'Error in getUserGroups controller');
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user._id;
    const { cursor } = req.query;
    const requestedLimit = req.query.limit ?? '50';
    const limit = Number(requestedLimit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: 'Limit must be an integer between 1 and 100' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isMember = conversation.members.some((m) => m.userId.equals(userId));
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: you are not a member of this group' });
    }

    const query = { conversationId };
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (Number.isNaN(cursorDate.getTime())) {
        return res.status(400).json({ message: 'Invalid pagination cursor' });
      }
      query.createdAt = { $lt: cursorDate };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', '_id fullName profilePic email');

    // Mark group messages as read by current user asynchronously
    Message.updateMany(
      { conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    ).catch((err) => logger.warn({ error: err.message }, 'Failed updating group read receipts'));

    res.status(200).json(messages.reverse());
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    logger.error({ error: error.message }, 'Error in getGroupMessages controller');
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { text, image } = req.body;
    const senderId = req.user._id;

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText && !image) {
      return res.status(400).json({ message: 'Text or image is required.' });
    }
    if (image && typeof image !== 'string') {
      return res.status(400).json({ message: 'Image must be a valid string payload.' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const isMember = conversation.members.some((m) => m.userId.equals(senderId));
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: you are not a member of this group' });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      conversationId,
      text: normalizedText,
      image: imageUrl,
      readBy: [senderId],
    });

    await newMessage.save();
    messagesSentCounter.inc();

    // Touch conversation updatedAt for recency sorting
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(newMessage._id).populate(
      'senderId',
      '_id fullName profilePic email'
    );

    // Broadcast to the group's Socket.io room
    io.to(`group:${conversationId}`).emit('newGroupMessage', {
      message: populatedMessage,
      conversationId,
    });

    res.status(201).json({
      ack: true,
      message: populatedMessage,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    logger.error({ error: error.message }, 'Error in sendGroupMessage controller');
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const memberIndex = conversation.members.findIndex((m) => m.userId.equals(userId));
    if (memberIndex === -1) {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }

    const leavingMember = conversation.members[memberIndex];
    conversation.members.splice(memberIndex, 1);

    // Case A: no one left — clean up the conversation and all its messages
    if (conversation.members.length === 0) {
      await Message.deleteMany({ conversationId });
      await Conversation.findByIdAndDelete(conversationId);

      io.to(`group:${conversationId}`).emit('memberLeftGroup', {
        conversationId,
        userId,
        remainingMembers: 0,
        promotedAdmin: null,
      });

      return res.status(200).json({ message: 'Left group successfully' });
    }

    // Case B: leaving member was the last admin — promote the longest-tenured member
    let promotedAdmin = null;
    const isAdmin = leavingMember.role === 'admin';
    const hasRemainingAdmin = conversation.members.some((m) => m.role === 'admin');

    if (isAdmin && !hasRemainingAdmin) {
      // Sort ascending by joinedAt; pick the earliest (most senior) member
      const oldest = conversation.members.slice().sort(
        (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)
      )[0];
      oldest.role = 'admin';
      promotedAdmin = oldest.userId;
    }

    await conversation.save();

    io.to(`group:${conversationId}`).emit('memberLeftGroup', {
      conversationId,
      userId,
      remainingMembers: conversation.members.length,
      promotedAdmin: promotedAdmin ? promotedAdmin.toString() : null,
    });

    res.status(200).json({ message: 'Left group successfully' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    logger.error({ error: error.message }, 'Error in leaveGroup controller');
    res.status(500).json({ message: 'Internal server error' });
  }
};

