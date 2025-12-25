
import React, { useState, useEffect } from 'react';
import { User } from '../types';
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
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync users from DB
  const updateUsers = () => {
    const allUsers = db.getUsers().filter(u => u.id !== currentUser.id);
    setUsers(allUsers);
    
    // If a user is selected, update their local data (for online status)
    if (selectedUser) {
      const updatedSelected = allUsers.find(u => u.id === selectedUser.id);
      if (updatedSelected) setSelectedUser(updatedSelected);
    }
  };

  useEffect(() => {
    updateUsers();
  }, [currentUser.id, refreshKey]);

  // Periodic UI refresh for online status
  useEffect(() => {
    const interval = setInterval(() => {
      updateUsers();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleBack = () => {
    setSelectedUser(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Sidebar - Hidden on mobile if a chat is selected */}
      <div 
        className={`
          ${selectedUser ? 'hidden md:flex' : 'flex'} 
          w-full md:w-[350px] flex-shrink-0 border-r border-slate-200 flex flex-col h-full bg-slate-50/30
        `}
      >
        <Sidebar 
          currentUser={currentUser} 
          users={users} 
          selectedUserId={selectedUser?.id}
          onUserSelect={(user) => setSelectedUser(user)}
          onLogout={onLogout}
          refreshKey={refreshKey}
        />
      </div>

      {/* Main Chat Area - Hidden on mobile if no chat is selected */}
      <div className={`
        ${!selectedUser ? 'hidden md:flex' : 'flex'} 
        flex-grow flex flex-col bg-slate-100 relative h-full
      `}>
        {selectedUser ? (
          <ChatWindow 
            targetUser={selectedUser} 
            currentUser={currentUser} 
            onMessageSent={handleRefresh}
            onBack={handleBack}
          />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="bg-slate-200/50 p-6 rounded-full mb-4">
               <i className="fa-solid fa-paper-plane text-5xl text-blue-400"></i>
            </div>
            <h2 className="text-xl font-medium text-slate-600">Select a person to start messaging</h2>
            <p className="mt-2 text-slate-400 text-sm max-w-xs text-center">
              Choose one of the registered users from the sidebar to begin your chat.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
