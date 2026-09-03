import React, { useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
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
  if (!date) return '';
  const diff = (Date.now() - new Date(date).getTime()) / 1000; // seconds
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ChatsList() {
  const {
    getMyChatPartners,
    chats,
    getGroups,
    groups,
    isUsersLoading,
    isGroupsLoading,
    selectedUser,
    selectedGroup,
    setSelectedUser,
    setSelectedGroup,
  } = useChatStore();
  const { onlineUsers, unreadMessages, clearUnread, authUser } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
    getGroups();
  }, [getMyChatPartners, getGroups]);

  // Combine DMs and groups into a unified recency-sorted list
  const combinedConversations = useMemo(() => {
    const dmItems = chats.map((chat) => ({
      type: 'dm',
      id: chat._id,
      timestamp: chat.lastMessageAt ? new Date(chat.lastMessageAt).getTime() : 0,
      data: chat,
    }));

    const groupItems = groups.map((group) => {
      const lastMsgTime = group.lastMessage?.createdAt
        ? new Date(group.lastMessage.createdAt).getTime()
        : new Date(group.updatedAt || group.createdAt).getTime();

      return {
        type: 'group',
        id: group._id,
        timestamp: lastMsgTime,
        data: group,
      };
    });

    return [...dmItems, ...groupItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [chats, groups]);

  if (isUsersLoading && isGroupsLoading && combinedConversations.length === 0) {
    return <UsersLoadingSkeleton />;
  }

  if (combinedConversations.length === 0) {
    return <NoChatsFound />;
  }

  return (
    <>
      {combinedConversations.map((item) => {
        if (item.type === 'group') {
          const group = item.data;
          const isSelected = selectedGroup?._id === group._id;

          let preview = '';
          if (group.lastMessage?.image && !group.lastMessage?.text) {
            preview = '📷 Photo';
          } else if (group.lastMessage?.text) {
            preview = group.lastMessage.text;
          }

          if (preview && group.lastMessage?.sender) {
            const isMine = group.lastMessage.sender._id?.toString() === authUser?._id?.toString();
            const senderName = isMine ? 'You' : group.lastMessage.sender.fullName?.split(' ')[0] || 'Member';
            preview = `${senderName}: ${preview}`;
          }

          const lastTime = group.lastMessage?.createdAt || group.updatedAt;

          return (
            <button
              key={`group_${group._id}`}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`w-full text-left group rounded-xl px-3.5 py-3 transition-all border ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-500/70 shadow-md shadow-cyan-500/5'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80 hover:border-cyan-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full ring-1 ring-cyan-500/40 bg-gradient-to-br from-cyan-900/40 to-slate-900 flex items-center justify-center text-cyan-300 overflow-hidden">
                    {group.avatar ? (
                      <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <h4 className="text-sm font-medium text-slate-100 truncate">{group.name}</h4>
                      <span className="text-[10px] text-cyan-400/90 px-1.5 py-0.5 rounded-full bg-cyan-500/10 font-medium shrink-0">
                        {group.members?.length || 0}
                      </span>
                    </div>
                    {lastTime && (
                      <span className="text-[10px] text-slate-500 group-hover:text-cyan-300 shrink-0">
                        {formatRelativeTime(lastTime)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs truncate text-slate-400">
                    {preview || 'Tap to open group conversation'}
                  </p>
                </div>
              </div>
            </button>
          );
        }

        // Direct message item
        const chat = item.data;
        const isSelected = selectedUser?._id === chat._id;
        const isOnline = onlineUsers.includes(chat._id);
        const unread = unreadMessages[chat._id] || 0;

        let preview = '';
        if (chat.isEncrypted) {
          preview = '🔒 Encrypted message';
        } else if (chat.lastMessageImage && !chat.lastMessageText) {
          preview = '📷 Photo';
        } else if (chat.lastMessageText) {
          preview = chat.lastMessageText;
        }

        const isMine = chat.lastMessageSenderId?.toString() === authUser?._id?.toString();
        if (preview && isMine && !chat.isEncrypted) preview = `You: ${preview}`;

        return (
          <button
            key={`dm_${chat._id}`}
            type="button"
            onClick={() => {
              setSelectedUser(chat);
              clearUnread(chat._id);
            }}
            className={`w-full text-left group rounded-xl px-3.5 py-3 transition-all border ${
              isSelected
                ? 'bg-slate-800/90 border-cyan-500/70 shadow-md shadow-cyan-500/5'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80 hover:border-cyan-500/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden">
                  <img src={chat.profilePic || '/avatar.png'} alt={chat.fullName} />
                </div>
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-slate-100 truncate">{chat.fullName}</h4>
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
                <p
                  className={`mt-0.5 text-xs truncate ${
                    unread > 0 ? 'text-slate-200 font-medium' : 'text-slate-500'
                  }`}
                >
                  {preview || 'Tap to open your conversation'}
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