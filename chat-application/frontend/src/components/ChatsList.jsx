import React, { useEffect } from 'react';
import {useChatStore} from '../store/useChatStore';
import UsersLoadingSkeleton from './UsersLoadingSkeleton';
import NoChatsFound from './NoChatsFound';
import {useAuthStore} from '../store/useAuthStore';

function ChatsList() {
  const { getMyChatPartners, chats, isUsersLoading, setSelectedUser } = useChatStore();
  const { onlineUsers, unreadMessages, clearUnread } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  return (
    <>
      {chats.map((chat) => {
        const isOnline = onlineUsers.includes(chat._id);
        return (
          <button
            key={chat._id}
            type="button"
            onClick={() => {
                setSelectedUser(chat);
                clearUnread(chat._id);
            }}
            className="w-full text-left group bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/60 rounded-xl px-3.5 py-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`avatar ${isOnline ? "online" : "offline"}`}>
                <div className="size-11 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden">
                  <img src={chat.profilePic || "/avatar.png"} alt={chat.fullName} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-slate-100 truncate">
                    {chat.fullName}
                  </h4>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 group-hover:text-cyan-300">
                    {isOnline ? "Online" : "Offline"}
                  </span>
                  {unreadMessages[chat._id] > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-cyan-500 rounded-full">
                          {unreadMessages[chat._id]}
                      </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500 truncate">
                  Tap to open your conversation
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}

export default ChatsList;