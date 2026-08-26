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
                useChatStore.getState().addIncomingMessage(newMessage);
            } else {
                set((state) => ({
                    unreadMessages: {
                        ...state.unreadMessages,
                        [newMessage.senderId]: (state.unreadMessages[newMessage.senderId] || 0) + 1,
                    },
                }));
                useChatStore.getState().getMyChatPartners();
            }

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

        socket.on("typing",     ({ senderId }) => useChatStore.getState().setUserTyping(senderId));
        socket.on("stopTyping", ({ senderId }) => useChatStore.getState().clearUserTyping(senderId));
    },

    disconnectSocket: ()=>{
        if(get().socket?.connected) get().socket.disconnect();
        set({socket:null,onlineUsers:[]});
    },
}));