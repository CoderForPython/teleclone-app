
import React, { useState, useEffect } from 'react';
import { User, Message, CallData } from '../types';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import CallOverlay from './CallOverlay';
import AdminPanel from './AdminPanel';
import { db } from '../services/db';

const SUPPORT_BOT: User = {
  id: 'bot_support',
  username: 'Support Bot 🤖',
  status: 'online',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support',
  lastSeen: Date.now()
};

interface MainLayoutProps {
  currentUser: User;
  onLogout: () => void;
  onUserUpdate: (updates: Partial<User>) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ currentUser, onLogout, onUserUpdate }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, Message>>({});
  const [activeCall, setActiveCall] = useState<CallData | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = db.subscribeToUsers((allUsers) => {
      const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
      setUsers([SUPPORT_BOT, ...otherUsers]);
      
      if (selectedUser) {
        if (selectedUser.id === SUPPORT_BOT.id) {
          setSelectedUser(SUPPORT_BOT);
        } else {
          const updatedSelected = otherUsers.find(u => u.id === selectedUser.id);
          if (updatedSelected) {
            setSelectedUser(updatedSelected);
          } else {
            setSelectedUser(null);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [currentUser.id, selectedUser?.id]);

  useEffect(() => {
    const unsubscribe = db.subscribeToLastMessages((msgs) => {
      setLastMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = db.subscribeToIncomingCall(currentUser.id, (call) => {
      if (call && (call.status === 'ringing' || call.status === 'accepted')) {
        setActiveCall(call);
      } else {
        setActiveCall(null);
      }
    });
    return () => unsubscribe();
  }, [currentUser.id]);

  const handleBack = () => {
    setSelectedUser(null);
  };

  const startCall = (target: User, type: 'audio' | 'video') => {
    if (target.id === 'bot_support') {
      alert("Бот не принимает звонки");
      return;
    }
    const callId = `call_${Date.now()}`;
    const newCall: CallData = {
      id: callId,
      callerId: currentUser.id,
      callerName: currentUser.username,
      callerAvatar: currentUser.avatar || '',
      receiverId: target.id,
      status: 'ringing',
      type: type,
      timestamp: Date.now()
    };
    setActiveCall(newCall);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white relative">
      {activeCall && (
        <CallOverlay 
          currentUser={currentUser} 
          activeCall={activeCall} 
          onClose={() => setActiveCall(null)} 
        />
      )}

      {isAdminPanelOpen && (
        <AdminPanel 
          users={users} 
          currentUser={currentUser} 
          onClose={() => setIsAdminPanelOpen(false)} 
        />
      )}

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
          onUserUpdate={onUserUpdate}
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
            onStartCall={(type) => startCall(selectedUser, type)}
            onOpenAdmin={() => setIsAdminPanelOpen(true)}
          />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="bg-slate-200/50 p-6 rounded-full mb-4">
               <i className="fa-solid fa-paper-plane text-5xl text-blue-400"></i>
            </div>
            <h2 className="text-xl font-medium text-slate-600 text-center">Выберите чат, чтобы начать общение</h2>
            <p className="mt-2 text-slate-400 text-sm max-w-xs text-center">
              Общайтесь с друзьями или нашим новым ботом поддержки.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
