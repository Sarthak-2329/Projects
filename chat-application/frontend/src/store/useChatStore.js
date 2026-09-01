import { create } from 'zustand';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

// Map of typing timeouts per user to guarantee cleanup on unexpected disconnect
const typingTimeouts = new Map();
const groupTypingTimeouts = new Map();
let historyRequestId = 0;

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  groups: [],
  messages: [],
  hasMoreMessages: true,
  isLoadingMore: false,
  activeTab: 'chats',
  selectedUser: null,
  selectedGroup: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isGroupsLoading: false,
  isSoundEnabled: localStorage.getItem('isSoundEnabled') === 'true',

  // --- Typing indicators (1:1 DMs) ---
  typingUsers: new Set(), // Set of userIds currently typing

  setUserTyping: (userId) => {
    if (typingTimeouts.has(userId)) {
      clearTimeout(typingTimeouts.get(userId));
    }

    const timeout = setTimeout(() => {
      get().clearUserTyping(userId);
    }, 4000);
    typingTimeouts.set(userId, timeout);

    set((state) => {
      const next = new Set(state.typingUsers);
      next.add(userId);
      return { typingUsers: next };
    });
  },

  clearUserTyping: (userId) => {
    if (typingTimeouts.has(userId)) {
      clearTimeout(typingTimeouts.get(userId));
      typingTimeouts.delete(userId);
    }
    set((state) => {
      const next = new Set(state.typingUsers);
      next.delete(userId);
      return { typingUsers: next };
    });
  },

  // --- Group typing indicators ---
  // Map of conversationId -> { [userId]: userName }
  groupTyping: {},

  setGroupUserTyping: (conversationId, userId, userName) => {
    const key = `${conversationId}:${userId}`;
    if (groupTypingTimeouts.has(key)) {
      clearTimeout(groupTypingTimeouts.get(key));
    }

    const timeout = setTimeout(() => {
      get().clearGroupUserTyping(conversationId, userId);
    }, 4000);
    groupTypingTimeouts.set(key, timeout);

    set((state) => {
      const currentMap = state.groupTyping[conversationId] || {};
      return {
        groupTyping: {
          ...state.groupTyping,
          [conversationId]: {
            ...currentMap,
            [userId]: userName || 'Someone',
          },
        },
      };
    });
  },

  clearGroupUserTyping: (conversationId, userId) => {
    const key = `${conversationId}:${userId}`;
    if (groupTypingTimeouts.has(key)) {
      clearTimeout(groupTypingTimeouts.get(key));
      groupTypingTimeouts.delete(key);
    }

    set((state) => {
      const currentMap = { ...(state.groupTyping[conversationId] || {}) };
      delete currentMap[userId];
      return {
        groupTyping: {
          ...state.groupTyping,
          [conversationId]: currentMap,
        },
      };
    });
  },

  // --- Quick-reply prefill ---
  quickReplyText: '',
  setQuickReply: (text) => set({ quickReplyText: text }),

  toggleSound: () => {
    localStorage.setItem('isSoundEnabled', !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  // Select a 1:1 conversation partner
  setSelectedUser: (selectedUser) => {
    typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    typingTimeouts.clear();

    set({
      selectedUser,
      selectedGroup: null,
      typingUsers: new Set(),
      messages: [],
      hasMoreMessages: true,
      isLoadingMore: false,
    });
  },

  // Select a group conversation
  setSelectedGroup: (selectedGroup) => {
    groupTypingTimeouts.forEach((timeout) => clearTimeout(timeout));
    groupTypingTimeouts.clear();

    set({
      selectedGroup,
      selectedUser: null,
      messages: [],
      hasMoreMessages: true,
      isLoadingMore: false,
    });
  },

  closeChat: () => {
    set({
      selectedUser: null,
      selectedGroup: null,
      messages: [],
    });
  },

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get('/messages/contacts');
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load contacts');
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get('/messages/chats');
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load chats');
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get('/conversations');
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load groups');
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async ({ name, members }) => {
    try {
      const res = await axiosInstance.post('/conversations', { name, members });
      toast.success('Group created successfully!');
      set((state) => ({ groups: [res.data, ...state.groups] }));
      get().setSelectedGroup(res.data);

      const socket = useAuthStore.getState().socket;
      if (socket) {
        socket.emit('joinGroup', { conversationId: res.data._id });
      }
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create group');
      throw error;
    }
  },

  getMessagesByUserId: async (userId) => {
    const requestId = ++historyRequestId;
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      if (requestId === historyRequestId) {
        set({ messages: res.data, hasMoreMessages: res.data.length >= 50 });
      }
    } catch (error) {
      if (requestId === historyRequestId) {
        toast.error(error.response?.data?.message || 'Something went wrong');
      }
    } finally {
      if (requestId === historyRequestId) set({ isMessagesLoading: false });
    }
  },

  getGroupMessages: async (groupId) => {
    const requestId = ++historyRequestId;
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/conversations/${groupId}/messages`);
      if (requestId === historyRequestId) {
        set({ messages: res.data, hasMoreMessages: res.data.length >= 50 });
      }
    } catch (error) {
      if (requestId === historyRequestId) {
        toast.error(error.response?.data?.message || 'Failed to load group messages');
      }
    } finally {
      if (requestId === historyRequestId) set({ isMessagesLoading: false });
    }
  },

  loadMoreMessages: async (userId) => {
    const { messages, isLoadingMore, hasMoreMessages } = get();
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) return;

    set({ isLoadingMore: true });
    try {
      const cursor = messages[0].createdAt;
      const res = await axiosInstance.get(`/messages/${userId}?cursor=${cursor}&limit=50`);
      set((state) => ({
        ...(state.selectedUser?._id === userId
          ? {
              messages: [...res.data, ...state.messages],
              hasMoreMessages: res.data.length >= 50,
              isLoadingMore: false,
            }
          : {}),
      }));
    } catch (error) {
      set({ isLoadingMore: false });
      toast.error(error.response?.data?.message || 'Failed to load messages');
    }
  },

  loadMoreGroupMessages: async (groupId) => {
    const { messages, isLoadingMore, hasMoreMessages } = get();
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) return;

    set({ isLoadingMore: true });
    try {
      const cursor = messages[0].createdAt;
      const res = await axiosInstance.get(`/conversations/${groupId}/messages?cursor=${cursor}&limit=50`);
      set((state) => ({
        ...(state.selectedGroup?._id === groupId
          ? {
              messages: [...res.data, ...state.messages],
              hasMoreMessages: res.data.length >= 50,
              isLoadingMore: false,
            }
          : {}),
      }));
    } catch (error) {
      set({ isLoadingMore: false });
      toast.error(error.response?.data?.message || 'Failed to load group messages');
    }
  },

  sendMessage: async (data) => {
    const { selectedUser } = get();
    const { authUser } = useAuthStore.getState();
    if (!selectedUser || !authUser) return;
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: data.text,
      image: data.image,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    set((state) => ({ messages: [...state.messages, optimisticMessage] }));

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, data);
      const savedMessage = res.data.message;
      set((state) => ({
        messages: state.messages
          .filter((msg) => msg._id !== savedMessage._id || msg._id === tempId)
          .map((msg) => (msg._id === tempId ? savedMessage : msg)),
      }));
      get().getMyChatPartners();
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter((msg) => msg._id !== tempId),
      }));
      toast.error(error.response?.data?.message || 'Failed to send message');
    }
  },

  sendGroupMessage: async (data) => {
    const { selectedGroup } = get();
    const { authUser } = useAuthStore.getState();
    if (!selectedGroup || !authUser) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      senderId: {
        _id: authUser._id,
        fullName: authUser.fullName,
        profilePic: authUser.profilePic,
      },
      conversationId: selectedGroup._id,
      text: data.text,
      image: data.image,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };

    set((state) => ({ messages: [...state.messages, optimisticMessage] }));

    try {
      const res = await axiosInstance.post(`/conversations/${selectedGroup._id}/messages`, data);
      const savedMessage = res.data.message;
      set((state) => ({
        messages: state.messages
          .filter((msg) => msg._id !== savedMessage._id || msg._id === tempId)
          .map((msg) => (msg._id === tempId ? savedMessage : msg)),
      }));
      get().getGroups();
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter((msg) => msg._id !== tempId),
      }));
      toast.error(error.response?.data?.message || 'Failed to send group message');
    }
  },

  leaveGroup: async (groupId) => {
    try {
      await axiosInstance.post(`/conversations/${groupId}/leave`);
      toast.success('Left group');
      if (get().selectedGroup?._id === groupId) {
        get().closeChat();
      }
      get().getGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to leave group');
    }
  },

  addIncomingMessage: (message) => {
    set((state) => {
      if (state.messages.some((m) => m._id === message._id)) {
        return state;
      }
      return {
        messages: [...state.messages, message],
      };
    });
  },

  updateMessageStatus: (messageId, status, timestamp) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg._id === messageId ? { ...msg, status, ...(timestamp && { deliveredAt: timestamp }) } : msg
      ),
    }));
  },

  markAllReadFromSender: (readerId, readAt) => {
    const { selectedUser } = get();
    if (!selectedUser || selectedUser._id !== readerId) return;

    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.receiverId === readerId && msg.status !== "read"
          ? { ...msg, status: "read", readAt }
          : msg
      ),
    }));
  },
}));
