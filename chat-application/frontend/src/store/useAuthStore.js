import {create} from 'zustand';
import {axiosInstance} from "../lib/axios";
import toast from 'react-hot-toast';
import {io} from 'socket.io-client';
import { useChatStore } from './useChatStore';

const BASE_URL = import.meta.env.MODE==="development" ? "http://localhost:3000" : "/";

export const useAuthStore = create((set,get)=>({
    authUser:null,
    isCheckingAuth:true,
    isSigningUp:false,
    isLoggingIn:false,
    socket:null,
    onlineUsers:[],
    unreadMessages: {},

    clearUnread: (userId) => set((state) => {
        const updated = { ...state.unreadMessages };
        delete updated[userId];
        return { unreadMessages: updated };
    }),

    checkAuth: async ()=>{
        try {
            const res = await axiosInstance.get("/auth/check");
            set({authUser:res.data});
            get().connectSocket();
        } catch (error) {
            console.log("Error in authCheck: ",error);
            set({authUser:null});
        } finally{
            set({isCheckingAuth:false});
        }
    },

    signup: async (data)=>{
        set({isSigningUp:true});
        try {
            const res = await axiosInstance.post("/auth/signup",data);
            set({authUser:res.data});
            toast.success("Account created successfully!");
            get().connectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        }finally{
            set({isSigningUp:false});
        }
    },

    login: async (data)=>{
        set({isLoggingIn:true});
        try {
            const res = await axiosInstance.post("/auth/login",data);
            set({authUser:res.data});
            toast.success("Logged in successfully");
            get().connectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        }finally{
            set({isLoggingIn:false});
        }
    },

    logout: async ()=>{
        try {
            await axiosInstance.post("/auth/logout");
            set({authUser:null});
            toast.success("Logged out successfully");
            get().disconnectSocket();
        } catch (error) {
            toast.error("Error logging out");
            console.log("Logout error: ",error);
        }
    },

    updateProfile: async (data)=>{
        try {
            const res = await axiosInstance.put("/auth/update-profile",data);
            set({authUser:res.data});
            toast.success("Profile updated successfully");
        } catch (error) {
            console.log("Error in update profile: ",error);
            toast.error(error.response.data.message);
        }
    },

    connectSocket: ()=>{
        const {authUser} = get();
        if(!authUser || get().socket?.connected) return;

        const socket = io(BASE_URL, {
            withCredentials: true,
        });

        socket.connect();
        set({socket});

        socket.on("getOnlineUsers",(userIds)=>{
            set({onlineUsers:userIds});
        });

        socket.on("newMessage", (newMessage) => {
            const { selectedUser } = useChatStore.getState();
            if (selectedUser && newMessage.senderId === selectedUser._id) {
                // Message is for the currently open chat — add to messages
                useChatStore.getState().addIncomingMessage(newMessage);
            } else {
                // Message from a different user — increment unread count
                set((state) => ({
                    unreadMessages: {
                        ...state.unreadMessages,
                        [newMessage.senderId]: (state.unreadMessages[newMessage.senderId] || 0) + 1,
                    },
                }));
                // Refresh chat partners list
                useChatStore.getState().getMyChatPartners();
            }

            // Play notification sound if enabled
            const { isSoundEnabled } = useChatStore.getState();
            if (isSoundEnabled) {
                const notificationSound = new Audio("/sounds/notification.mp3");
                notificationSound.currentTime = 0;
                notificationSound.play().catch((e) => console.log("Audio play error:", e));
            }
        });

        socket.on("messageStatusUpdated", ({ messageId, status, deliveredAt }) => {
            useChatStore.getState().updateMessageStatus(messageId, status, deliveredAt);
        });

        socket.on("messagesMarkedRead", ({ readBy, readAt }) => {
            const { authUser } = get();
            if (authUser) {
                useChatStore.getState().markAllReadFromSender(authUser._id, readAt);
            }
        });
    },

    disconnectSocket: ()=>{
        if(get().socket?.connected) get().socket.disconnect();
        set({socket:null,onlineUsers:[]});
    },
}));