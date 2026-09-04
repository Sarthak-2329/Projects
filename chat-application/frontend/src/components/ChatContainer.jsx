import { useEffect, useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import ChatHeader from './ChatHeader';
import NoChatHistoryPlaceholder from './NoChatHistoryPlaceholder';
import MessageInput from './MessageInput';
import MessagesLoadingSkeleton from './MessagesLoadingSkeleton';
import { getMyPrivateKey, importPublicKey, deriveSharedKey, decryptMessage } from '../lib/crypto';

function useDecryptedMessages(messages, partnerPublicKeyB64) {
  const [decryptedMap, setDecryptedMap] = useState(new Map());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const myPrivateKey = getMyPrivateKey();
      if (!myPrivateKey || !partnerPublicKeyB64) { setDecryptedMap(new Map()); return; }

      const encryptedMsgs = messages.filter((m) => m.encryptedText && m.iv);
      if (encryptedMsgs.length === 0) { setDecryptedMap(new Map()); return; }

      let sharedKey;
      try {
        const theirPubKey = await importPublicKey(partnerPublicKeyB64);
        sharedKey = await deriveSharedKey(myPrivateKey, theirPubKey);
      } catch {
        setDecryptedMap(new Map());
        return;
      }

      const entries = await Promise.all(
        encryptedMsgs.map(async (m) => {
          const plain = await decryptMessage(sharedKey, m.encryptedText, m.iv);
          return [m._id, plain];
        })
      );

      if (!cancelled) setDecryptedMap(new Map(entries));
    }

    run();
    return () => { cancelled = true; };
  }, [messages, partnerPublicKeyB64]);

  return decryptedMap;
}

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

  const decryptedMap = useDecryptedMessages(messages, selectedUser?.publicKey ?? null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') setLightboxUrl(null); };
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
      useAuthStore.getState().clearUnread(selectedGroup._id);
    } else if (selectedUser) {
      getMessagesByUserId(selectedUser._id);
      const socket = useAuthStore.getState().socket;
      if (socket) socket.emit('messageRead', { senderId: selectedUser._id });
      useAuthStore.getState().clearUnread(selectedUser._id);
    }
  }, [selectedUser, selectedGroup, getMessagesByUserId, getGroupMessages]);

  useEffect(() => {
    if (messageEndRef.current) messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isGroup = Boolean(selectedGroup);
  const activeTitle = selectedGroup ? selectedGroup.name : selectedUser?.fullName || 'Chat';

  return (
    <>
      <ChatHeader />
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 px-4 md:px-6 overflow-y-auto py-6 subtle-scroll bg-oat"
      >
        {messages.length > 0 && !isMessagesLoading ? (
          <div className="w-full space-y-4 md:space-y-5">
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
                  {/* Sender avatar — group incoming only */}
                  {isGroup && !isMine && (
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mb-1 border border-ink/15">
                      <img src={senderPic} alt={senderName} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div
                    className={`relative max-w-[80%] md:max-w-[70%] px-4 py-3 ${
                      isMine
                        ? 'rounded-2xl rounded-br-sm bg-forest text-cream shadow-[0_2px_8px_rgba(63,93,69,0.25)]'
                        : 'rounded-2xl rounded-bl-sm bg-cream text-ink border border-ink/10 shadow-[0_2px_6px_rgba(43,38,32,0.08)]'
                    }`}
                  >
                    {/* Sender name — group incoming */}
                    {isGroup && !isMine && (
                      <p className="font-serif text-[11px] font-semibold text-forest mb-1 leading-none">
                        {senderName}
                      </p>
                    )}

                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Shared"
                        onClick={() => setLightboxUrl(msg.image)}
                        className="rounded-lg h-48 object-cover mb-1 border border-ink/10 cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    )}

                    {/* Message text */}
                    {msg.encryptedText ? (
                      (() => {
                        const resolved = decryptedMap.get(msg._id) ?? msg.text ?? null;
                        if (resolved) return <p className="mt-1 leading-relaxed text-sm">{resolved}</p>;
                        return (
                          <p className="mt-1 leading-relaxed text-sm opacity-60 italic">
                            🔒 Encrypted
                          </p>
                        );
                      })()
                    ) : (
                      msg.text && <p className="mt-1 leading-relaxed text-sm">{msg.text}</p>
                    )}

                    <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${
                      isMine ? 'opacity-70 text-cream' : 'opacity-50 text-ink'
                    }`}>
                      {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {isMine && (
                        <span className={`ml-1 ${
                          msg.status === 'read' ? 'text-cream/90' : 'text-cream/60'
                        }`}>
                          {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'sending' ? '◌' : '✓'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={activeTitle} />
        )}
      </div>

      <MessageInput />

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm"
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
            className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-cream/90 border border-ink/15 text-ink hover:bg-cream transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>
          <p className="absolute bottom-4 text-cream/60 text-xs">
            Click outside or press Esc to close
          </p>
        </div>
      )}
    </>
  );
}

export default ChatContainer;
