
import React, { useState, useRef } from 'react';
import { User, Message } from '../types';
import { db } from '../services/db';

interface SidebarProps {
  currentUser: User;
  users: User[];
  lastMessages: Record<string, Message>;
  selectedUserId?: string;
  onUserSelect: (user: User) => void;
  onLogout: () => void;
  onUserUpdate: (updates: Partial<User>) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, users, lastMessages, selectedUserId, onUserSelect, onLogout, onUserUpdate }) => {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'chats' | 'settings'>('chats');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = users.filter(user => {
    return user.username.toLowerCase().includes(search.toLowerCase());
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        await db.updateUser(currentUser.id, { avatar: base64 });
        onUserUpdate({ avatar: base64 });
      } catch (err) {
        console.error("Avatar update failed:", err);
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setUploading(false);
      console.error("FileReader error");
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-white">
      {/* Settings Overlay */}
      <div className={`absolute inset-0 z-30 bg-white transition-transform duration-300 ease-in-out ${view === 'settings' ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex items-center space-x-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <button onClick={() => setView('chats')} className="text-slate-500 hover:text-blue-500 p-2 transition-colors">
            <i className="fa-solid fa-arrow-left text-lg"></i>
          </button>
          <h2 className="text-lg font-bold text-slate-800">Settings</h2>
        </div>
        
        <div className="flex flex-col items-center p-8 bg-slate-50 border-b border-slate-200">
          <div className="relative group cursor-pointer" onClick={() => !uploading && fileInputRef.current?.click()}>
            <img 
              src={currentUser.avatar} 
              className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover" 
              alt="Profile" 
            />
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fa-solid fa-camera text-white text-2xl"></i>
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center z-10">
                <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-2xl"></i>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-800">{currentUser.username}</h3>
          <p className="text-blue-500 text-sm font-medium">Online</p>
        </div>

        <div className="p-2 space-y-1 overflow-y-auto">
          <div className="px-4 py-3 flex items-center space-x-4 hover:bg-slate-50 cursor-pointer transition-colors rounded-xl mx-2">
            <div className="w-10 h-10 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-user"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Edit Profile</p>
              <p className="text-xs text-slate-400">Username, bio, etc.</p>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center space-x-4 hover:bg-red-50 cursor-pointer transition-colors rounded-xl mx-2 text-red-500" onClick={onLogout}>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-right-from-bracket"></i>
            </div>
            <p className="text-sm font-semibold">Log Out</p>
          </div>
        </div>
      </div>

      <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm z-20">
        <div className="flex items-center space-x-3 overflow-hidden">
          <img src={currentUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-800 leading-tight truncate">{currentUser.username}</span>
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Online</span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => setView('settings')}
            className="text-slate-400 hover:text-blue-500 p-2 transition-colors rounded-lg hover:bg-blue-50"
          >
            <i className="fa-solid fa-gear"></i>
          </button>
          <button 
            onClick={onLogout}
            className="text-slate-400 hover:text-red-500 p-2 transition-colors rounded-lg hover:bg-red-50"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </div>

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

      <div className="flex-grow overflow-y-auto space-y-1 py-2 bg-white">
        {filteredUsers.map(user => {
          const convId = db.getConversationId(currentUser.id, user.id);
          const lastMsg = lastMessages[convId];
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
                  {lastMsg ? (lastMsg.file ? '📎 File' : lastMsg.text) : (isOnline ? 'Online' : 'Offline')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
