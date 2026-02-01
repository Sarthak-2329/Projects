import React from 'react';
import { useAuthStore } from '../store/useAuthStore';

function ChatPage() {
  const {logout} = useAuthStore();
  
  return (
    <div>ChatPage</div>
  );
};

export default ChatPage;