import React, { useState, useEffect } from 'react';
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
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleMember = (id) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredContacts = allContacts.filter((contact) =>
    contact.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedMembers.size === 0) {
      toast.error('Please select at least one contact for the group');
      return;
    }

    setIsSubmitting(true);
    try {
      await createGroup({
        name: name.trim(),
        members: Array.from(selectedMembers),
      });
      onClose();
    } catch {
      // Error toasted in store
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Create New Group</h3>
              <p className="text-xs text-slate-400">Start a group conversation with your contacts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
          {/* Group Name input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Launch, Weekend Trips"
              maxLength={100}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/70"
              autoFocus
            />
          </div>

          {/* Member picker header & search */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Add Members ({selectedMembers.size} selected)
              </label>
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/70"
              />
            </div>

            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 subtle-scroll pr-1 max-h-56">
              {filteredContacts.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-6">No matching contacts</p>
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
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-slate-100'
                          : 'bg-slate-950/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={contact.profilePic || '/avatar.png'}
                          alt={contact.fullName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div className="text-left truncate">
                          <p className="text-xs font-medium truncate">{contact.fullName}</p>
                          <p className="text-[10px] text-slate-500 truncate">{contact.email}</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-cyan-500 border-cyan-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || selectedMembers.size === 0}
              className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
