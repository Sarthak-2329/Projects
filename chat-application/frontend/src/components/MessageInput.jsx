import { useRef, useState, useEffect } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import { ImageIcon, SendIcon, XIcon } from "lucide-react";

const TYPING_STOP_DELAY = 1000; // ms of silence before emitting stopTyping

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  const { sendMessage, isSoundEnabled, selectedUser, quickReplyText, setQuickReply } = useChatStore();
  const { socket } = useAuthStore();

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // --- Item 6: Prefill from quick-reply buttons ---
  useEffect(() => {
    if (quickReplyText) {
      setText(quickReplyText);
      setQuickReply("");
    }
  }, [quickReplyText, setQuickReply]);

  // --- Item 5: Typing indicator helpers ---
  const emitTyping = () => {
    if (!socket || !selectedUser) return;
    socket.emit("typing", { receiverId: selectedUser._id });
  };

  const emitStopTyping = () => {
    if (!socket || !selectedUser) return;
    socket.emit("stopTyping", { receiverId: selectedUser._id });
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (isSoundEnabled) playRandomKeyStrokeSound();

    emitTyping();

    // Debounce: reset the stop-typing timer on every keystroke
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(emitStopTyping, TYPING_STOP_DELAY);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    // Cancel any pending stop-typing timeout and emit immediately
    clearTimeout(typingTimeoutRef.current);
    emitStopTyping();

    sendMessage({
      text: text.trim(),
      image: imagePreview,
    });
    setText("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-4 border-t border-slate-800/80 bg-slate-950/80">
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700 shadow-lg"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex space-x-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-slate-900/70 border border-slate-800/80 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/70 focus:border-transparent resize-none overflow-y-auto max-h-32 subtle-scroll"
          placeholder="Type your message..."
          rows={1}
          style={{ minHeight: "44px" }}
        />

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`inline-flex items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 text-slate-400 hover:text-slate-100 hover:border-cyan-500/60 transition-colors ${
            imagePreview ? "text-cyan-400 border-cyan-500/70" : ""
          }`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <button
          type="submit"
          disabled={!text.trim() && !imagePreview}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-4 py-2.5 font-medium shadow-lg shadow-cyan-500/30 hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
export default MessageInput;