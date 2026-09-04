import { useState } from "react";
import { Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import CreateGroupModal from "./CreateGroupModal";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  return (
    <>
      <div className="px-4 pt-2 pb-3 flex items-center justify-between gap-2">
        <div className="inline-flex items-center rounded-full bg-oat border border-ink/15 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === "chats"
                ? "bg-forest/15 text-forest"
                : "text-ink/50 hover:text-ink"
            }`}
          >
            Chats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contacts")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === "contacts"
                ? "bg-forest/15 text-forest"
                : "text-ink/50 hover:text-ink"
            }`}
          >
            Contacts
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsGroupModalOpen(true)}
          title="Create New Group"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-oat border border-ink/15 text-ink/60 hover:text-forest hover:border-forest/50 hover:bg-forest/5 transition-all shadow-sm shrink-0"
        >
          <Users className="w-3.5 h-3.5 text-forest" />
          <span>New Group</span>
        </button>
      </div>

      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
      />
    </>
  );
}

export default ActiveTabSwitch;