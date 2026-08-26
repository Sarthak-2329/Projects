import { useEffect, useState, useMemo } from "react";
import { SearchIcon, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { useAuthStore } from "../store/useAuthStore";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers } = useAuthStore();

  const [query, setQuery] = useState("");

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  // Case-insensitive filter on name and email
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allContacts;
    return allContacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [allContacts, query]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  return (
    <>
      {/* ── Search input ─────────────────────────────── */}
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          className="w-full pl-8 pr-8 py-2 text-xs rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-500/40 transition"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Results ──────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <SearchIcon className="w-8 h-8 text-slate-700 mb-3" />
          <p className="text-sm text-slate-500">No contacts match</p>
          <p className="text-xs text-slate-600 mt-1">"{query}"</p>
        </div>
      ) : (
        filtered.map((contact) => {
          const isOnline = onlineUsers.includes(contact._id);
          return (
            <button
              key={contact._id}
              type="button"
              onClick={() => setSelectedUser(contact)}
              className="w-full text-left group bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/60 rounded-xl px-3.5 py-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="size-11 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden">
                    <img src={contact.profilePic || "/avatar.png"} alt={contact.fullName} />
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-slate-100 truncate">
                      {contact.fullName}
                    </h4>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 group-hover:text-cyan-300">
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    {contact.email}
                  </p>
                </div>
              </div>
            </button>
          );
        })
      )}
    </>
  );
}

export default ContactList;