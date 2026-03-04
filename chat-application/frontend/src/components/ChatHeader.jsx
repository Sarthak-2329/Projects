import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import { XIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

function ChatHeader() {
    const {selectedUser,setSelectedUser} = useChatStore();
    const {onlineUsers} = useAuthStore();
    const isOnline = onlineUsers.includes(selectedUser._id);

    useEffect(()=>{
        const handleEsckey = (event)=>{
            if(event.key==="Escape") setSelectedUser(null);
        };
        window.addEventListener("keydown",handleEsckey);
        return ()=> window.removeEventListener("keydown",handleEsckey);
    },[setSelectedUser]);

    return (
    <div className="flex justify-between items-center bg-slate-900/70 border-b border-slate-800/80 px-6 py-4">
        <div className="flex items-center space-x-3">
            <div className={`avatar ${isOnline ? "online" : "offline"}`}>
                <div className="w-11 h-11 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden">
                    <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                </div>
            </div>
            <div>
                <h3 className="text-slate-100 font-medium text-sm md:text-base">
                  {selectedUser.fullName}
                </h3>
                <p className="text-slate-400 text-xs md:text-sm">
                  {isOnline ? "Online now" : "Offline"}
                </p>
            </div>
        </div>
        <button
          type="button"
          onClick={()=>setSelectedUser(null)}
          className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/60 px-2.5 py-2 hover:border-slate-500 hover:bg-slate-800/80 transition-colors"
        >
            <XIcon className="w-4 h-4 text-slate-300" />
        </button>
    </div>
    );
};

export default ChatHeader;