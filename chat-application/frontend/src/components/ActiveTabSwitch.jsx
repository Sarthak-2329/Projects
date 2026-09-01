import React, { useState } from "react";
import { Users } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import CreateGroupModal from "./CreateGroupModal";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  return (
    <>
      <div className="px-4 pt-2 pb-3 flex items-center justify-between gap-2">
        <div className="inline-flex items-center rounded-full bg-slate-900/80 border border-slate-800/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === "chats"
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            Chats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contacts")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === "contacts"
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            Contacts
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsGroupModalOpen(true)}
          title="Create New Group"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-900/80 border border-slate-800/80 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all shadow-sm shrink-0"
        >
          <Users className="w-3.5 h-3.5 text-cyan-400" />
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