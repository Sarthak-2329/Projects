import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    hasMoreMessages,
    isLoadingMore,
    loadMoreMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 50 && hasMoreMessages && !isLoadingMore) {
        const prevScrollHeight = container.scrollHeight;
        loadMoreMessages(selectedUser._id).then(() => {
            // Restore scroll position after prepend
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
    getMessagesByUserId(selectedUser._id);
    
    // Mark messages as read
    const socket = useAuthStore.getState().socket;
    if (socket) {
        socket.emit("messageRead", { senderId: selectedUser._id });
    }
    // Also clear unread badge
    useAuthStore.getState().clearUnread(selectedUser._id);
  }, [selectedUser._id, getMessagesByUserId]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`chat w-full ${msg.senderId === authUser._id ? "chat-end" : "chat-start"}`}
              >
                <div
                  className={`chat-bubble relative shadow-lg ${
                    msg.senderId === authUser._id
                      ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white"
                      : "bg-slate-900 text-slate-100 border border-slate-800/90"
                  }`}
                >
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="Shared"
                      className="rounded-lg h-48 object-cover mb-1 border border-slate-800/80"
                    />
                  )}
                  {msg.text && <p className="mt-2">{msg.text}</p>}
                  <p className="text-[11px] mt-1 opacity-75 flex items-center gap-1 text-slate-300">
                    {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {msg.senderId === authUser._id && (
                        <span className={`ml-1 ${msg.status === 'read' ? 'text-blue-400' : msg.status === 'delivered' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓✓" : msg.status === "sending" ? "◌" : "✓"}
                        </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
            {/* 👇 scroll target */}
            <div ref={messageEndRef} />
          </div>
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser.fullName} />
        )}
      </div>

      <MessageInput />
    </>
  );
}

export default ChatContainer;
