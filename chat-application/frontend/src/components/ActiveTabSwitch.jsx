import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="inline-flex items-center rounded-full bg-slate-900/80 border border-slate-800/80 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("chats")}
          className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
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
          className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
            activeTab === "contacts"
              ? "bg-cyan-500/20 text-cyan-300"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          Contacts
        </button>
      </div>
    </div>
  );
}
export default ActiveTabSwitch;