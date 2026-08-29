import {create} from 'zustand';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

// Map of typing timeouts per user to guarantee cleanup on unexpected disconnect
const typingTimeouts = new Map();

export const useChatStore = create((set,get)=>({
    allContacts:[],
    chats:[],
    messages:[],
    hasMoreMessages: true,
    isLoadingMore: false,
    activeTab:"chats",
    selectedUser:null,
    isUsersLoading:false,
    isMessagesLoading:false,
    isSoundEnabled:localStorage.getItem("isSoundEnabled")==="true",

    // --- Item 5: Typing indicators ---
    typingUsers: new Set(), // Set of userIds currently typing

    setUserTyping: (userId) => {
        // Clear any existing auto-clear timer for this user
        if (typingTimeouts.has(userId)) {
            clearTimeout(typingTimeouts.get(userId));
        }

        // Set auto-clear timer for 4s in case stopTyping is missed
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

    // --- Item 6: Quick-reply prefill ---
    quickReplyText: "",

    setQuickReply: (text) => set({ quickReplyText: text }),

    // -----------------------------------------------------------------------

    toggleSound: ()=>{
        localStorage.setItem("isSoundEnabled",!get().isSoundEnabled);
        set({isSoundEnabled:!get().isSoundEnabled});
    },

    setActiveTab: (tab)=>set({activeTab:tab}),

    // Reset typing state when switching conversations
    setSelectedUser: (selectedUser) => {
        // Clean up all typing timeouts
        typingTimeouts.forEach((timeout) => clearTimeout(timeout));
        typingTimeouts.clear();
        set({ selectedUser, typingUsers: new Set() });
    },

    getAllContacts: async ()=>{
        set({isUsersLoading:true});
        try {
            const res = await axiosInstance.get("/messages/contacts");
            set({allContacts:res.data});
        } catch (error) {
            toast.error(error.response?.data?.message || error.response?.data?.error || "Failed to load contacts");
        }finally{
            set({isUsersLoading:false});
        }
    },

    getMyChatPartners: async ()=>{
        set({isUsersLoading:true});
        try {
            const res = await axiosInstance.get("/messages/chats");
            set({chats:res.data});
        } catch (error) {
            toast.error(error.response?.data?.message || error.response?.data?.error || "Failed to load chats");
        }finally{
            set({isUsersLoading:false});
        }
    },

    getMessagesByUserId: async (userId)=>{
        set({isMessagesLoading:true});
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({messages:res.data, hasMoreMessages: res.data.length >= 50});
        } catch (error) {
            toast.error(error.response?.data?.message || error.response?.data?.error || "Something went wrong");
        }finally{
            set({isMessagesLoading:false});
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
                messages: [...res.data, ...state.messages],
                hasMoreMessages: res.data.length >= 50,
                isLoadingMore: false,
            }));
        } catch (error) {
            set({ isLoadingMore: false });
            toast.error(error.response?.data?.message || error.response?.data?.error || "Failed to load messages");
        }
    },

    sendMessage: async (data) => {
        const { selectedUser } = get();
        const { authUser } = useAuthStore.getState();
        const tempId = `temp_${Date.now()}`;
        const optimisticMessage = {
            _id: tempId,
            senderId: authUser._id,
            receiverId: selectedUser._id,
            text: data.text,
            image: data.image,
            createdAt: new Date().toISOString(),
            status: "sending",
        };

        // Optimistic insert
        set((state) => ({ messages: [...state.messages, optimisticMessage] }));

        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, data);
            const savedMessage = res.data.message;
            // Swap temp with real message
            set((state) => ({
                messages: state.messages.map((msg) =>
                    msg._id === tempId ? savedMessage : msg
                ),
            }));
            // Update sidebar immediately with the new last message
            get().getMyChatPartners();
        } catch (error) {
            // Remove failed optimistic message
            set((state) => ({
                messages: state.messages.filter((msg) => msg._id !== tempId),
            }));
            toast.error(error.response?.data?.message || error.response?.data?.error || "Failed to send message");
        }
    },

    addIncomingMessage: (message) => {
        set((state) => {
            // Avoid adding duplicate messages (e.g. from multi-tab socket broadcasts)
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
        // Only mark messages as read if the reader is the currently selected user
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