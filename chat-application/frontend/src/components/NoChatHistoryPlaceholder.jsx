import { MessageCircleIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const NoChatHistoryPlaceholder = ({ name }) => {
  const { setQuickReply } = useChatStore();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 bg-forest/10 rounded-full flex items-center justify-center mb-5">
        <MessageCircleIcon className="size-8 text-forest" />
      </div>
      <h3 className="font-serif text-lg font-medium text-ink mb-3">
        Start your conversation with {name}
      </h3>
      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-ink/50 text-sm">
          This is the beginning of your conversation. Send a message to start chatting!
        </p>
        <div className="h-px w-32 bg-ink/10 mx-auto" />
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setQuickReply("👋 Say Hello!")}
          className="px-4 py-2 text-xs font-medium text-forest bg-forest/10 rounded-full hover:bg-forest/20 transition-colors"
        >
          👋 Say Hello
        </button>
        <button
          onClick={() => setQuickReply("🤝 How are you?")}
          className="px-4 py-2 text-xs font-medium text-forest bg-forest/10 rounded-full hover:bg-forest/20 transition-colors"
        >
          🤝 How are you?
        </button>
        <button
          onClick={() => setQuickReply("📅 Meet up soon?")}
          className="px-4 py-2 text-xs font-medium text-forest bg-forest/10 rounded-full hover:bg-forest/20 transition-colors"
        >
          📅 Meet up soon?
        </button>
      </div>
    </div>
  );
};

export default NoChatHistoryPlaceholder;