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
    openAvatarModal,
  } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    const handleEscKey = (event) => { if (event.key === 'Escape') closeChat(); };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [closeChat]);

  // Group header
  if (selectedGroup) {
    const activeTypers = Object.values(groupTyping[selectedGroup._id] || {});
    const isTyping = activeTypers.length > 0;
    const typingText =
      activeTypers.length === 1
        ? `${activeTypers[0]} is typing…`
        : `${activeTypers.slice(0, 2).join(', ')} are typing…`;
    const memberCount = selectedGroup.members?.length || 0;

    return (
      <div className="flex justify-between items-center bg-cream border-b border-ink/10 px-4 md:px-6 py-4">
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
          <button
            type="button"
            aria-label="Back to conversations"
            onClick={closeChat}
            className="md:hidden inline-flex items-center justify-center rounded-full p-1.5 text-ink/50 hover:text-ink hover:bg-ink/5 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            <div
              className={`w-10 h-10 md:w-11 md:h-11 rounded-full ring-1 ring-ink/15 bg-gradient-to-br from-forest/15 to-oat flex items-center justify-center text-forest overflow-hidden ${
                selectedGroup.avatar ? 'cursor-pointer hover:ring-forest/50 transition-all' : ''
              }`}
              onClick={() => {
                if (selectedGroup.avatar) {
                  openAvatarModal(selectedGroup.avatar, selectedGroup.name);
                }
              }}
              title={selectedGroup.avatar ? "View group photo" : undefined}
            >
              {selectedGroup.avatar ? (
                <img src={selectedGroup.avatar} alt={selectedGroup.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-ink font-medium text-sm md:text-base truncate">
              {selectedGroup.name}
            </h3>
            <p className="text-ink/45 text-xs md:text-sm truncate">
              {isTyping ? (
                <span className="text-forest italic">{typingText}</span>
              ) : (
                `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Leave group"
            onClick={() => leaveGroup(selectedGroup._id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rust/20 bg-rust/8 text-rust hover:bg-rust/15 hover:border-rust/35 text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <button
            type="button"
            aria-label="Close conversation"
            onClick={closeChat}
            className="hidden md:inline-flex items-center justify-center rounded-full border border-ink/15 bg-oat px-2.5 py-2 hover:border-ink/30 hover:bg-ink/5 transition-colors"
          >
            <XIcon className="w-4 h-4 text-ink/60" />
          </button>
        </div>
      </div>
    );
  }

  if (!selectedUser) return null;

  // DM header
  const isOnline = onlineUsers.includes(selectedUser._id);
  const isTyping = typingUsers.has(selectedUser._id);

  return (
    <div className="flex justify-between items-center bg-cream border-b border-ink/10 px-4 md:px-6 py-4">
      <div className="flex items-center space-x-2 md:space-x-3">
        <button
          type="button"
          aria-label="Back to conversations"
          onClick={closeChat}
          className="md:hidden inline-flex items-center justify-center rounded-full p-1.5 text-ink/50 hover:text-ink hover:bg-ink/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          className="relative shrink-0 cursor-pointer group"
          onClick={() => openAvatarModal(selectedUser.profilePic || '/avatar.png', selectedUser.fullName)}
          title="View profile photo"
        >
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-full ring-1 ring-ink/15 ring-offset-2 ring-offset-cream overflow-hidden group-hover:ring-forest/50 transition-all">
            <img
              src={selectedUser.profilePic || '/avatar.png'}
              alt={selectedUser.fullName}
              className="w-full h-full object-cover"
            />
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-sage border-2 border-cream rounded-full" />
          )}
        </div>

        <div>
          <h3 className="font-serif text-ink font-medium text-sm md:text-base">
            {selectedUser.fullName}
          </h3>
          <p className="text-ink/45 text-xs md:text-sm">
            {isTyping ? (
              <span className="text-forest italic">typing…</span>
            ) : isOnline ? (
              <span className="text-sage">Online now</span>
            ) : (
              'Offline'
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        aria-label="Close conversation"
        onClick={closeChat}
        className="hidden md:inline-flex items-center justify-center rounded-full border border-ink/15 bg-oat px-2.5 py-2 hover:border-ink/30 hover:bg-ink/5 transition-colors"
      >
        <XIcon className="w-4 h-4 text-ink/60" />
      </button>
    </div>
  );
}

export default ChatHeader;