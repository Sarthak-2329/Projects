import { useEffect } from "react";
import { XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

function AvatarModal() {
  const { avatarModal, closeAvatarModal } = useChatStore();
  const { isOpen, imageUrl, title } = avatarModal;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeAvatarModal();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeAvatarModal]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-200 animate-in fade-in"
      onClick={closeAvatarModal}
    >
      <div
        className="relative max-w-sm sm:max-w-md w-full bg-cream rounded-3xl p-5 shadow-2xl border border-ink/15 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-1 border-b border-ink/10">
          <h3 className="font-serif text-ink text-base font-semibold truncate pr-4">
            {title || "Profile Picture"}
          </h3>
          <button
            type="button"
            onClick={closeAvatarModal}
            className="p-1.5 rounded-full hover:bg-ink/10 text-ink/60 hover:text-ink transition-colors"
            title="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Large Profile Image */}
        <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl overflow-hidden border border-ink/15 bg-oat/50 flex items-center justify-center shadow-md">
          <img
            src={imageUrl}
            alt={title || "Profile"}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export default AvatarModal;
