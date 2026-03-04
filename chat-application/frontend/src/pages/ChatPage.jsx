import React from 'react';
import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import { useChatStore } from '../store/useChatStore';
import ProfileHeader from '../components/ProfileHeader';
import ActiveTabSwitch from '../components/ActiveTabSwitch';
import ChatsList from '../components/ChatsList';
import ContactList from '../components/ContactList';
import ChatContainer from '../components/ChatContainer';
import NoConversationPlaceholder from '../components/NoConversationPlaceholder';

function ChatPage() {
  const {activeTab,selectedUser} = useChatStore();

  return (
    <div className="body-gradient flex w-full h-screen px-4 py-4 overflow-hidden">
  <div className="relative w-full h-full">
    <BorderAnimatedContainer>
      <div className="w-full h-full flex glass-card rounded-3xl overflow-hidden">

        {/* Left column */}
        <div className="w-[240px] xl:w-[260px] bg-slate-900/75 border-r border-slate-800/70 backdrop-blur-xl flex flex-col">
          <ProfileHeader />
          <ActiveTabSwitch />
          <div className="flex-1 overflow-y-auto p-4 space-y-2 subtle-scroll">
            {activeTab==="chats" ? <ChatsList /> : <ContactList />}
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col bg-slate-950/80">
          {selectedUser ? <ChatContainer /> : <NoConversationPlaceholder />}
        </div>

      </div>
    </BorderAnimatedContainer>
  </div>
</div>
  );
};

export default ChatPage;