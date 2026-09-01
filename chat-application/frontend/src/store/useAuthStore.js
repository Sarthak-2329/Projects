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
    isRequestingReset: false,
    isResettingPassword: false,
    isVerifyingEmail: false,
    isResendingVerification: false,
    /** Non-null while the user has signed up but not yet verified their email. */
    pendingVerificationEmail: null,
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

    // -------------------------------------------------------------------------
    // Signup — no JWT is issued; backend returns { pendingVerification, email }.
    // Sets pendingVerificationEmail so SignUpPage shows a "check your inbox" UI.
    // -------------------------------------------------------------------------
    signup: async (data)=>{
        set({isSigningUp:true});
        try {
            const res = await axiosInstance.post("/auth/signup",data);
            if (res.data.pendingVerification) {
                set({ pendingVerificationEmail: res.data.email });
                toast.success("Account created! Check your email to verify.");
            } else {
                // Defensive fallback (should not occur with current backend)
                set({authUser:res.data});
                get().connectSocket();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Signup failed");
        }finally{
            set({isSigningUp:false});
        }
    },

    // -------------------------------------------------------------------------
    // Login — returns the error code string on failure so the page can show
    // a targeted UI for EMAIL_UNVERIFIED without a generic toast.
    // -------------------------------------------------------------------------
    login: async (data)=>{
        set({isLoggingIn:true});
        try {
            const res = await axiosInstance.post("/auth/login",data);
            set({authUser:res.data});
            toast.success("Logged in successfully");
            get().connectSocket();
            return null;
        } catch (error) {
            const code = error.response?.data?.code;
            if (code !== 'EMAIL_UNVERIFIED') {
                toast.error(error.response?.data?.message || "Login failed");
            }
            return code || null;
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
            toast.error(error.response?.data?.message || "Update failed");
        }
    },

    // -------------------------------------------------------------------------
    // Email verification — POSTs the raw token (from the URL) to the backend.
    // On success the backend issues a JWT cookie and returns the user object.
    // -------------------------------------------------------------------------
    verifyEmail: async (token) => {
        set({ isVerifyingEmail: true });
        try {
            const res = await axiosInstance.post("/auth/verify-email", { token });
            set({ authUser: res.data, pendingVerificationEmail: null });
            toast.success("Email verified! Welcome to Messenger 🎉");
            get().connectSocket();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Verification failed. The link may have expired.");
            return false;
        } finally {
            set({ isVerifyingEmail: false });
        }
    },

    // -------------------------------------------------------------------------
    // Resend verification email — used from SignUpPage and VerifyEmailPage.
    // -------------------------------------------------------------------------
    resendVerification: async (email) => {
        set({ isResendingVerification: true });
        try {
            await axiosInstance.post("/auth/resend-verification", { email });
            toast.success("Verification email sent! Check your inbox.");
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to resend. Please try again.");
            return false;
        } finally {
            set({ isResendingVerification: false });
        }
    },

    // -------------------------------------------------------------------------
    // Password reset (item 4)
    // -------------------------------------------------------------------------
    forgotPassword: async (email) => {
        set({ isRequestingReset: true });
        try {
            await axiosInstance.post("/auth/forgot-password", { email });
            toast.success("If that email is registered, a reset link has been sent.");
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Something went wrong. Please try again.");
            return false;
        } finally {
            set({ isRequestingReset: false });
        }
    },

    resetPassword: async (token, password) => {
        set({ isResettingPassword: true });
        try {
            await axiosInstance.post(`/auth/reset-password/${token}`, { password });
            toast.success("Password reset successful! You can now log in.");
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Invalid or expired reset link.");
            return false;
        } finally {
            set({ isResettingPassword: false });
        }
    },

    // -------------------------------------------------------------------------
    // Socket.io
    // -------------------------------------------------------------------------
    connectSocket: ()=>{
        const {authUser} = get();
        // A socket that is still connecting is already usable and will reconnect
        // itself. Creating a second one here duplicates every event listener.
        if(!authUser || get().socket) return;

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
            const senderId = newMessage.senderId?.toString();
            const receiverId = newMessage.receiverId?.toString();
            const selectedUserId = selectedUser?._id?.toString();
            const authUserId = authUser._id?.toString();

            if (selectedUserId && senderId === selectedUserId) {
                useChatStore.getState().addIncomingMessage(newMessage);
            } else if (selectedUserId && receiverId === selectedUserId && senderId === authUserId) {
                // Incoming message from another tab/device of the same logged-in user
                useChatStore.getState().addIncomingMessage(newMessage);
            } else if (senderId !== authUserId) {
                // Never create an unread badge for this account when another one
                // of its tabs/devices sends a message.
                set((state) => ({
                    unreadMessages: {
                        ...state.unreadMessages,
                        [senderId]: (state.unreadMessages[senderId] || 0) + 1,
                    },
                }));
            }

            // Always update sidebar preview and order in real time
            useChatStore.getState().getMyChatPartners();

            const { isSoundEnabled } = useChatStore.getState();
            if (isSoundEnabled && newMessage.senderId !== authUser._id) {
                const notificationSound = new Audio("/sounds/notification.mp3");
                notificationSound.currentTime = 0;
                notificationSound.play().catch((e) => console.log("Audio play error:", e));
            }
        });

        socket.on("messageStatusUpdated", ({ messageId, status, deliveredAt }) => {
            useChatStore.getState().updateMessageStatus(messageId, status, deliveredAt);
        });

        socket.on("messagesMarkedRead", ({ readBy, readAt }) => {
            useChatStore.getState().markAllReadFromSender(readBy, readAt);
        });

        socket.on("newGroupMessage", ({ message, conversationId }) => {
            const { selectedGroup } = useChatStore.getState();
            const selectedGroupId = selectedGroup?._id?.toString();

            if (selectedGroupId && selectedGroupId === conversationId?.toString()) {
                useChatStore.getState().addIncomingMessage(message);
            }

            useChatStore.getState().getGroups();

            const { isSoundEnabled } = useChatStore.getState();
            const senderId = message.senderId?._id || message.senderId;
            if (isSoundEnabled && senderId?.toString() !== authUser._id?.toString()) {
                const notificationSound = new Audio("/sounds/notification.mp3");
                notificationSound.currentTime = 0;
                notificationSound.play().catch((e) => console.log("Audio play error:", e));
            }
        });

        socket.on("groupCreated", (group) => {
            socket.emit("joinGroup", { conversationId: group._id });
            useChatStore.getState().getGroups();
        });

        socket.on("typing", ({ senderId, senderName, conversationId }) => {
            if (conversationId) {
                useChatStore.getState().setGroupUserTyping(conversationId, senderId, senderName);
            } else {
                useChatStore.getState().setUserTyping(senderId);
            }
        });

        socket.on("stopTyping", ({ senderId, conversationId }) => {
            if (conversationId) {
                useChatStore.getState().clearGroupUserTyping(conversationId, senderId);
            } else {
                useChatStore.getState().clearUserTyping(senderId);
            }
        });
    },

    disconnectSocket: ()=>{
        get().socket?.disconnect();
        set({socket:null,onlineUsers:[]});
    },
}));
