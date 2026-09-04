import { useRef, useState, useEffect } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import { ImageIcon, SendIcon, XIcon } from "lucide-react";

const TYPING_STOP_DELAY = 1000;

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    sendMessage,
    sendGroupMessage,
    isSoundEnabled,
    selectedUser,
    selectedGroup,
    quickReplyText,
    setQuickReply,
  } = useChatStore();
  const { socket } = useAuthStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
  };

  useEffect(() => {
    if (quickReplyText) { setText(quickReplyText); setQuickReply(""); }
  }, [quickReplyText, setQuickReply]);

  const emitTyping = () => {
    if (!socket) return;
    if (selectedGroup) socket.emit("typing", { conversationId: selectedGroup._id });
    else if (selectedUser) socket.emit("typing", { receiverId: selectedUser._id });
  };

  const emitStopTyping = () => {
    if (!socket) return;
    if (selectedGroup) socket.emit("stopTyping", { conversationId: selectedGroup._id });
    else if (selectedUser) socket.emit("stopTyping", { receiverId: selectedUser._id });
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (isSoundEnabled) playRandomKeyStrokeSound();
    if (val.trim() === "") { clearTimeout(typingTimeoutRef.current); emitStopTyping(); }
    else {
      emitTyping();
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(emitStopTyping, TYPING_STOP_DELAY);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();
    clearTimeout(typingTimeoutRef.current);
    emitStopTyping();
    const payload = { text: text.trim(), image: imagePreview };
    if (selectedGroup) sendGroupMessage(payload);
    else if (selectedUser) sendMessage(payload);
    setText("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-4 border-t border-ink/10 bg-cream">
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-ink/15 shadow-sm"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-cream border border-ink/20 flex items-center justify-center text-ink/60 hover:text-ink hover:bg-oat transition-colors"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex space-x-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-oat border border-ink/20 rounded-xl py-2.5 px-4 text-sm text-ink placeholder-ink/35 focus:outline-none focus:ring-2 focus:ring-forest focus:border-transparent resize-none overflow-y-auto max-h-32 subtle-scroll transition"
          placeholder="Type your message…"
          rows={1}
          style={{ minHeight: "44px" }}
        />

        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`inline-flex items-center justify-center rounded-xl border border-ink/20 bg-oat px-4 text-ink/40 hover:text-forest hover:border-forest/40 transition-colors ${
            imagePreview ? "text-forest border-forest/40" : ""
          }`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        <button
          type="submit"
          disabled={!text.trim() && !imagePreview}
          className="inline-flex items-center justify-center rounded-xl bg-forest text-cream px-4 py-2.5 font-medium shadow-sm hover:bg-forest/90 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;