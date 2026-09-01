import { useEffect, useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import ChatHeader from './ChatHeader';
import NoChatHistoryPlaceholder from './NoChatHistoryPlaceholder';
import MessageInput from './MessageInput';
import MessagesLoadingSkeleton from './MessagesLoadingSkeleton';

function ChatContainer() {
  const {
    selectedUser,
    selectedGroup,
    getMessagesByUserId,
    getGroupMessages,
    messages,
    isMessagesLoading,
    hasMoreMessages,
    isLoadingMore,
    loadMoreMessages,
    loadMoreGroupMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const [lightboxUrl, setLightboxUrl] = useState(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxUrl]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 50 && hasMoreMessages && !isLoadingMore) {
      const prevScrollHeight = container.scrollHeight;

      const loadMoreAction = selectedGroup
        ? loadMoreGroupMessages(selectedGroup._id)
        : loadMoreMessages(selectedUser._id);

      loadMoreAction.then(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop =
              scrollContainerRef.current.scrollHeight - prevScrollHeight;
          }
        });
      });
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      getGroupMessages(selectedGroup._id);
    } else if (selectedUser) {
      getMessagesByUserId(selectedUser._id);

      const socket = useAuthStore.getState().socket;
      if (socket) {
        socket.emit('messageRead', { senderId: selectedUser._id });
      }
      useAuthStore.getState().clearUnread(selectedUser._id);
    }
  }, [selectedUser, selectedGroup, getMessagesByUserId, getGroupMessages]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const isGroup = Boolean(selectedGroup);
  const activeTitle = selectedGroup ? selectedGroup.name : selectedUser?.fullName || 'Chat';

  return (
    <>
      <ChatHeader />
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 px-4 md:px-6 overflow-y-auto py-6 subtle-scroll bg-gradient-to-b from-slate-950/40 via-slate-950/80 to-slate-950"
      >
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="w-full space-y-4 md:space-y-6">
            {messages.map((msg) => {
              const senderId = msg.senderId?._id || msg.senderId;
              const isMine = senderId?.toString() === authUser?._id?.toString();
              const senderName = msg.senderId?.fullName || 'Member';
              const senderPic = msg.senderId?.profilePic || '/avatar.png';

              return (
                <div
                  key={msg._id}
                  className={`flex w-full items-end gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Sender avatar for incoming messages in group chats */}
                  {isGroup && !isMine && (
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mb-1 border border-slate-700">
                      <img src={senderPic} alt={senderName} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div
                    className={`relative shadow-lg max-w-[80%] md:max-w-[70%] px-4 py-3 ${
                      isMine
                        ? 'rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                        : 'rounded-2xl rounded-bl-sm bg-slate-900 text-slate-100 border border-slate-800/90'
                    }`}
                  >
                    {/* Display sender's name on group messages */}
                    {isGroup && !isMine && (
                      <p className="text-[11px] font-semibold text-cyan-400 mb-1 leading-none">
                        {senderName}
                      </p>
                    )}

                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Shared"
                        onClick={() => setLightboxUrl(msg.image)}
                        className="rounded-lg h-48 object-cover mb-1 border border-slate-800/80 cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    )}

                    {msg.text && <p className="mt-1 leading-relaxed">{msg.text}</p>}

                    <p className="text-[11px] mt-1.5 opacity-75 flex items-center gap-1 text-slate-300">
                      {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {isMine && (
                        <span
                          className={`ml-1 ${
                            msg.status === 'read'
                              ? 'text-blue-400'
                              : msg.status === 'delivered'
                              ? 'text-gray-400'
                              : 'text-gray-500'
                          }`}
                        >
                          {msg.status === 'read'
                            ? '✓✓'
                            : msg.status === 'delivered'
                            ? '✓✓'
                            : msg.status === 'sending'
                            ? '◌'
                            : '✓'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
            {/* scroll target */}
            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={activeTitle} />
        )}
      </div>

      <MessageInput />

      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>
          <p className="absolute bottom-4 text-slate-400 text-xs">
            Click outside or press Esc to close
          </p>
        </div>
      )}
    </>
  );
}

export default ChatContainer;
