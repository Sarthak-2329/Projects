import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { useAuthStore } from "../store/useAuthStore";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  return (
    <>
      {allContacts.map((contact) => {
        const isOnline = onlineUsers.includes(contact._id);
        return (
          <button
            key={contact._id}
            type="button"
            onClick={() => setSelectedUser(contact)}
            className="w-full text-left group bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/60 rounded-xl px-3.5 py-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`avatar ${isOnline ? "online" : "offline"}`}>
                <div className="size-11 rounded-full ring-1 ring-slate-700/80 ring-offset-2 ring-offset-slate-900 overflow-hidden">
                  <img src={contact.profilePic || "/avatar.png"} alt={contact.fullName} />
                </div>
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
                  Start a new conversation with this contact
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}
export default ContactList;