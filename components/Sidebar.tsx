
import React, { useState } from 'react';
import { User, Message } from '../types';
import { db } from '../services/db';

interface SidebarProps {
  currentUser: User;
  users: User[];
  selectedUserId?: string;
  onUserSelect: (user: User) => void;
  onLogout: () => void;
  refreshKey: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, users, selectedUserId, onUserSelect, onLogout, refreshKey }) => {
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter(user => {
    return user.username.toLowerCase().includes(search.toLowerCase());
  });

  const getUserLastMessage = (userId: string): Message | undefined => {
    const convId = db.getConversationId(currentUser.id, userId);
    return db.getLastMessage(convId);
  };

  return (
    <>
      {/* Top Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm z-20">
        <div className="flex items-center space-x-3 overflow-hidden">
          <img src={currentUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-800 leading-tight truncate">{currentUser.username}</span>
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Settings</span>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="text-slate-400 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-red-50"
          title="Logout"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-100 border-none rounded-xl py-2 px-4 pl-10 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-900"
          />
          <i className="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        </div>
      </div>

      {/* User List */}
      <div className="flex-grow overflow-y-auto space-y-1 py-2 bg-white">
        {filteredUsers.length === 0 && (
          <p className="text-center text-slate-400 text-xs mt-10">No users found</p>
        )}
        {filteredUsers.map(user => {
          const lastMsg = getUserLastMessage(user.id);
          const isSelected = selectedUserId === user.id;
          const isOnline = db.isOnline(user);

          return (
            <div 
              key={user.id}
              onClick={() => onUserSelect(user)}
              className={`px-4 py-3 cursor-pointer flex items-center space-x-3 transition-all mx-2 rounded-xl group ${
                isSelected ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' : 'hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <img 
                  src={user.avatar} 
                  className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-white object-cover shadow-sm"
                  alt={user.username}
                />
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {user.username}
                  </h3>
                  {lastMsg && (
                    <span className={`text-[10px] ml-2 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                      {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                  {lastMsg ? lastMsg.text : (isOnline ? 'Online' : 'Offline')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default Sidebar;
