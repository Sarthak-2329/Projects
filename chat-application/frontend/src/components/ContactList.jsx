import { useEffect, useState, useMemo } from "react";
import { SearchIcon, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { useAuthStore } from "../store/useAuthStore";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [query, setQuery] = useState("");

  useEffect(() => { getAllContacts(); }, [getAllContacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allContacts;
    return allContacts.filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [allContacts, query]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  return (
    <>
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/35 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          className="w-full pl-8 pr-8 py-2 text-xs rounded-lg bg-oat border border-ink/20 text-ink placeholder-ink/35 focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest/40 transition"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/35 hover:text-ink transition"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <SearchIcon className="w-8 h-8 text-ink/20 mb-3" />
          <p className="text-sm text-ink/40">No contacts match</p>
          <p className="text-xs text-ink/25 mt-1">"{query}"</p>
        </div>
      ) : (
        filtered.map((contact) => {
          const isOnline = onlineUsers.includes(contact._id);
          return (
            <button
              key={contact._id}
              type="button"
              onClick={() => setSelectedUser(contact)}
              className="w-full text-left group bg-cream/60 hover:bg-cream border border-ink/8 hover:border-ink/20 rounded-xl px-3.5 py-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="size-11 rounded-full ring-1 ring-ink/15 ring-offset-2 ring-offset-cream overflow-hidden">
                    <img src={contact.profilePic || "/avatar.png"} alt={contact.fullName} />
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-sage border-2 border-cream rounded-full" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-serif text-sm font-medium text-ink truncate">
                      {contact.fullName}
                    </h4>
                    <span className={`text-[10px] uppercase tracking-wide ${
                      isOnline ? 'text-sage' : 'text-ink/30'
                    } group-hover:opacity-80 transition-opacity`}>
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink/40 truncate">{contact.email}</p>
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