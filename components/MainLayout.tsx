
import React, { useState, useEffect } from 'react';
import { User, Message } from '../types';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import { db } from '../services/db';

interface MainLayoutProps {
  currentUser: User;
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ currentUser, onLogout }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});

  // Subscribe to all users (online status, avatars, etc.)
  useEffect(() => {
    const unsubscribe = db.subscribeToUsers((allUsers) => {
      const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
      setUsers(otherUsers);
      
      // Update selected user data if they changed
      if (selectedUser) {
        const updatedSelected = otherUsers.find(u => u.id === selectedUser.id);
        if (updatedSelected) setSelectedUser(updatedSelected);
      }
    });
    return () => unsubscribe();
  }, [currentUser.id, selectedUser?.id]);

  // Subscribe to last messages for sidebar previews
  useEffect(() => {
    const unsubscribe = db.subscribeToLastMessages((msgs) => {
      setLastMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  const handleBack = () => {
    setSelectedUser(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <div 
        className={`
          ${selectedUser ? 'hidden md:flex' : 'flex'} 
          w-full md:w-[350px] flex-shrink-0 border-r border-slate-200 flex flex-col h-full bg-slate-50/30
        `}
      >
        <Sidebar 
          currentUser={currentUser} 
          users={users} 
          lastMessages={lastMessages}
          selectedUserId={selectedUser?.id}
          onUserSelect={(user) => setSelectedUser(user)}
          onLogout={onLogout}
        />
      </div>

      <div className={`
        ${!selectedUser ? 'hidden md:flex' : 'flex'} 
        flex-grow flex flex-col bg-slate-100 relative h-full
      `}>
        {selectedUser ? (
          <ChatWindow 
            targetUser={selectedUser} 
            currentUser={currentUser} 
            onBack={handleBack}
          />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="bg-slate-200/50 p-6 rounded-full mb-4">
               <i className="fa-solid fa-paper-plane text-5xl text-blue-400"></i>
            </div>
            <h2 className="text-xl font-medium text-slate-600">Select a person to start messaging</h2>
            <p className="mt-2 text-slate-400 text-sm max-w-xs text-center">
              Real-time synchronization via Firebase is active.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
