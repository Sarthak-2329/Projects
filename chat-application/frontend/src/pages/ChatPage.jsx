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
  const { activeTab, selectedUser, selectedGroup } = useChatStore();
  const activeConversation = selectedUser || selectedGroup;

  return (
    <div className="body-gradient flex w-full h-screen px-2 py-2 sm:px-4 sm:py-4 overflow-hidden">
      <div className="relative w-full h-full">
        <BorderAnimatedContainer>
          <div className="w-full h-full flex glass-card rounded-2xl sm:rounded-3xl overflow-hidden">

            {/*
              Left column — sidebar
              Mobile  : full-width, visible only when NO conversation is open
              Desktop : fixed 240px (260px on xl), always visible
            */}
            <div
              className={[
                'flex-col bg-slate-900/75 border-r border-slate-800/70 backdrop-blur-xl',
                'w-full md:w-[240px] xl:w-[260px]',
                activeConversation ? 'hidden md:flex' : 'flex',
              ].join(' ')}
            >
              <ProfileHeader />
              <ActiveTabSwitch />
              <div className="flex-1 overflow-y-auto p-4 space-y-2 subtle-scroll">
                {activeTab === "chats" ? <ChatsList /> : <ContactList />}
              </div>
            </div>

            {/*
              Right column — conversation pane
              Mobile  : full-width, visible only when a conversation IS open
              Desktop : flex-1, always visible
            */}
            <div
              className={[
                'flex-col bg-slate-950/80 flex-1',
                activeConversation ? 'flex' : 'hidden md:flex',
              ].join(' ')}
            >
              {activeConversation ? <ChatContainer /> : <NoConversationPlaceholder />}
            </div>

          </div>
        </BorderAnimatedContainer>
      </div>
    </div>
  );
}

export default ChatPage;