import React from 'react';
import { useAuthStore } from '../store/useAuthStore';

function ChatPage() {
  const {authUser,isLoggedIn,login} = useAuthStore();
  return (
    <div>ChatPage</div>
  )
}

export default ChatPage;