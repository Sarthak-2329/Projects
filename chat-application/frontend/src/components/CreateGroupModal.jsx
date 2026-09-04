import { useState, useEffect } from 'react';
import { X, Users, Search, Check } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import toast from 'react-hot-toast';

function CreateGroupModal({ isOpen, onClose }) {
  const { allContacts, getAllContacts, createGroup } = useChatStore();
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getAllContacts();
      setName('');
      setSearchQuery('');
      setSelectedMembers(new Set());
    }
  }, [isOpen, getAllContacts]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleMember = (id) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredContacts = allContacts.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Please enter a group name'); return; }
    if (selectedMembers.size === 0) { toast.error('Please select at least one contact for the group'); return; }
    setIsSubmitting(true);
    try {
      await createGroup({ name: name.trim(), members: Array.from(selectedMembers) });
      onClose();
    } catch {
      // Error toasted in store
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-cream border border-ink/12 rounded-2xl shadow-[0_16px_48px_rgba(43,38,32,0.15)] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-forest/10 text-forest">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold text-ink">Create New Group</h3>
              <p className="text-xs text-ink/45">Start a group conversation with your contacts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-ink/40 hover:text-ink hover:bg-oat rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1.5">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Launch, Weekend Trips"
              maxLength={100}
              className="w-full bg-oat border border-ink/20 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-ink/35 focus:outline-none focus:ring-2 focus:ring-forest transition"
              autoFocus
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-ink/60">
                Add Members ({selectedMembers.size} selected)
              </label>
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 text-ink/35 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts…"
                className="w-full bg-oat border border-ink/20 rounded-xl pl-9 pr-3.5 py-2 text-xs text-ink placeholder-ink/35 focus:outline-none focus:ring-2 focus:ring-forest transition"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 subtle-scroll pr-1 max-h-56">
              {filteredContacts.length === 0 ? (
                <p className="text-center text-xs text-ink/35 py-6">No matching contacts</p>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedMembers.has(contact._id);
                  return (
                    <button
                      key={contact._id}
                      type="button"
                      onClick={() => toggleMember(contact._id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-forest/10 border-forest/30 text-ink'
                          : 'bg-oat border-ink/12 text-ink/70 hover:bg-oat/80 hover:border-ink/25'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={contact.profilePic || '/avatar.png'}
                          alt={contact.fullName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div className="text-left truncate">
                          <p className="text-xs font-medium truncate text-ink">{contact.fullName}</p>
                          <p className="text-[10px] text-ink/40 truncate">{contact.email}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-forest border-forest text-cream'
                          : 'border-ink/25 bg-cream'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-ink/10 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink/60 hover:text-ink rounded-xl hover:bg-oat transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || selectedMembers.size === 0}
              className="px-4 py-2 text-xs font-medium text-cream bg-forest hover:bg-forest/90 rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;
