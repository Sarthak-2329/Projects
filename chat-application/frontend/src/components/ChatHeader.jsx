import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import { ArrowLeft, XIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

function ChatHeader() {
    const { selectedUser, setSelectedUser, typingUsers } = useChatStore();
    const { onlineUsers } = useAuthStore();
    const isOnline = onlineUsers.includes(selectedUser._id);
    const isTyping = typingUsers.has(selectedUser._id);

    useEffect(() => {
        const handleEsckey = (event) => {
            if (event.key === "Escape") setSelectedUser(null);
        };
        window.addEventListener("keydown", handleEsckey);
        return () => window.removeEventListener("keydown", handleEsckey);
    }, [setSelectedUser]);

    return (
        <div className="flex justify-between items-center bg-slate-900/70 border-b border-slate-800/80 px-4 md:px-6 py-4">
            <div className="flex items-center space-x-2 md:space-x-3">

                {/* ← Back arrow: mobile only — taps back to the contacts list */}
                <button
                    type="button"
                    aria-label="Back to conversations"
                    onClick={() => setSelectedUser(null)}
                    className="md:hidden inline-flex items-center justify-center rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative">
                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden">
                        <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                    </div>
                    {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                    )}
                </div>

                <div>
                    <h3 className="text-slate-100 font-medium text-sm md:text-base">
                        {selectedUser.fullName}
                    </h3>
                    <p className="text-slate-400 text-xs md:text-sm">
                        {isTyping
                            ? <span className="text-cyan-400 italic">typing…</span>
                            : isOnline ? "Online now" : "Offline"
                        }
                    </p>
                </div>
            </div>

            {/* × Close: desktop only — on mobile the back arrow handles navigation */}
            <button
                type="button"
                aria-label="Close conversation"
                onClick={() => setSelectedUser(null)}
                className="hidden md:inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/60 px-2.5 py-2 hover:border-slate-500 hover:bg-slate-800/80 transition-colors"
            >
                <XIcon className="w-4 h-4 text-slate-300" />
            </button>
        </div>
    );
}

export default ChatHeader;