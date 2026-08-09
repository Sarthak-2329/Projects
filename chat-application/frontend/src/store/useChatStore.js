import {create} from 'zustand';
import { axiosInstance } from '../lib/axios';
import toast from 'react-hot-toast';
import { useAuthStore } from './useAuthStore';

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

    toggleSound: ()=>{
        localStorage.setItem("isSoundEnabled",!get().isSoundEnabled);
        set({isSoundEnabled:!get().isSoundEnabled});
    },

    setActiveTab: (tab)=>set({activeTab:tab}),

    setSelectedUser: (selectedUser)=>set({selectedUser}),

    getAllContacts: async ()=>{
        set({isUsersLoading:true});
        try {
            const res = await axiosInstance.get("/messages/contacts");
            set({allContacts:res.data});
        } catch (error) {
            toast.error(error.response.data.message);
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
            toast.error(error.response.data.message);
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
            toast.error(error.response?.data?.message || "Something went wrong");
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
            toast.error(error.response?.data?.message || "Failed to load messages");
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
        } catch (error) {
            // Remove failed optimistic message
            set((state) => ({
                messages: state.messages.filter((msg) => msg._id !== tempId),
            }));
            toast.error(error.response?.data?.message || "Failed to send message");
        }
    },

    addIncomingMessage: (message) => {
        set((state) => ({
            messages: [...state.messages, message],
        }));
    },

    updateMessageStatus: (messageId, status, timestamp) => {
        set((state) => ({
            messages: state.messages.map((msg) =>
                msg._id === messageId ? { ...msg, status, ...(timestamp && { deliveredAt: timestamp }) } : msg
            ),
        }));
    },

    markAllReadFromSender: (senderId, readAt) => {
        set((state) => ({
            messages: state.messages.map((msg) =>
                msg.senderId === senderId && msg.status !== "read"
                    ? { ...msg, status: "read", readAt }
                    : msg
            ),
        }));
    },
}));