import React, { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import UsersLoadingSkeleton from './UsersLoadingSkeleton';
import NoChatsFound from './NoChatsFound';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Formats a Date into a compact relative string:
 *   < 1 min  → "now"
 *   < 1 hr   → "5m"
 *   < 1 day  → "3h"
 *   < 7 days → "Mon"
 *   otherwise → "Aug 10"
 */
function formatRelativeTime(date) {
  if (!date) return "";
  const diff = (Date.now() - new Date(date).getTime()) / 1000; // seconds
  if (diff < 60)     return "now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return new Date(date).toLocaleDateString(undefined, { weekday: "short" });
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChatsList() {
  const { getMyChatPartners, chats, isUsersLoading, setSelectedUser } = useChatStore();
  const { onlineUsers, unreadMessages, clearUnread, authUser } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  return (
    <>
      {chats.map((chat) => {
        const isOnline = onlineUsers.includes(chat._id);
        const unread   = unreadMessages[chat._id] || 0;

        // Build the preview snippet
        let preview = "";
        if (chat.lastMessageImage && !chat.lastMessageText) {
          preview = "📷 Photo";
        } else if (chat.lastMessageText) {
          preview = chat.lastMessageText;
        }

        // Prefix "You: " when the logged-in user sent the last message
        const isMine = chat.lastMessageSenderId?.toString() === authUser?._id?.toString();
        if (preview && isMine) preview = `You: ${preview}`;

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
              <div className="relative">
                <div className="w-12 h-12 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden shrink-0">
                  <img src={chat.profilePic || "/avatar.png"} alt={chat.fullName} />
                </div>
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-slate-100 truncate">
                    {chat.fullName}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unread > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-cyan-500 rounded-full">
                        {unread}
                      </span>
                    )}
                    {chat.lastMessageAt && (
                      <span className="text-[10px] text-slate-500 group-hover:text-cyan-300">
                        {formatRelativeTime(chat.lastMessageAt)}
                      </span>
                    )}
                  </div>
                </div>
                <p className={`mt-0.5 text-xs truncate ${unread > 0 ? "text-slate-200 font-medium" : "text-slate-500"}`}>
                  {preview || "Tap to open your conversation"}
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