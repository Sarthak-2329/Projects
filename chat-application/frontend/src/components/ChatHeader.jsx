import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { ArrowLeft, XIcon, Users, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

function ChatHeader() {
  const {
    selectedUser,
    selectedGroup,
    closeChat,
    typingUsers,
    groupTyping,
    leaveGroup,
  } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') closeChat();
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [closeChat]);

  // Group Conversation Header
  if (selectedGroup) {
    const activeTypers = Object.values(groupTyping[selectedGroup._id] || {});
    const isTyping = activeTypers.length > 0;
    const typingText =
      activeTypers.length === 1
        ? `${activeTypers[0]} is typing…`
        : `${activeTypers.slice(0, 2).join(', ')} are typing…`;

    const memberCount = selectedGroup.members?.length || 0;

    return (
      <div className="flex justify-between items-center bg-slate-900/70 border-b border-slate-800/80 px-4 md:px-6 py-4">
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
          {/* Back arrow: mobile only */}
          <button
            type="button"
            aria-label="Back to conversations"
            onClick={closeChat}
            className="md:hidden inline-flex items-center justify-center rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-full ring-1 ring-cyan-500/40 bg-gradient-to-br from-cyan-900/40 to-slate-900 flex items-center justify-center text-cyan-300 overflow-hidden">
              {selectedGroup.avatar ? (
                <img src={selectedGroup.avatar} alt={selectedGroup.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-slate-100 font-medium text-sm md:text-base truncate">
              {selectedGroup.name}
            </h3>
            <p className="text-slate-400 text-xs md:text-sm truncate">
              {isTyping ? (
                <span className="text-cyan-400 italic">{typingText}</span>
              ) : (
                `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Leave group button */}
          <button
            type="button"
            title="Leave group"
            onClick={() => leaveGroup(selectedGroup._id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          {/* Close button: desktop only */}
          <button
            type="button"
            aria-label="Close conversation"
            onClick={closeChat}
            className="hidden md:inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/60 px-2.5 py-2 hover:border-slate-500 hover:bg-slate-800/80 transition-colors"
          >
            <XIcon className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>
    );
  }

  if (!selectedUser) return null;

  // Direct Message Header
  const isOnline = onlineUsers.includes(selectedUser._id);
  const isTyping = typingUsers.has(selectedUser._id);

  return (
    <div className="flex justify-between items-center bg-slate-900/70 border-b border-slate-800/80 px-4 md:px-6 py-4">
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Back arrow: mobile only */}
        <button
          type="button"
          aria-label="Back to conversations"
          onClick={closeChat}
          className="md:hidden inline-flex items-center justify-center rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden">
            <img src={selectedUser.profilePic || '/avatar.png'} alt={selectedUser.fullName} />
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
            {isTyping ? (
              <span className="text-cyan-400 italic">typing…</span>
            ) : isOnline ? (
              'Online now'
            ) : (
              'Offline'
            )}
          </p>
        </div>
      </div>

      {/* Close button: desktop only */}
      <button
        type="button"
        aria-label="Close conversation"
        onClick={closeChat}
        className="hidden md:inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/60 px-2.5 py-2 hover:border-slate-500 hover:bg-slate-800/80 transition-colors"
      >
        <XIcon className="w-4 h-4 text-slate-300" />
      </button>
    </div>
  );
}

export default ChatHeader;