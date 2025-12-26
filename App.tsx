
import React, { useState, useEffect } from 'react';
import { User } from './types';
import Auth from './components/Auth';
import MainLayout from './components/MainLayout';
import { db } from './services/db';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  // Sync current user status from DB in real-time (especially for blocking)
  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = db.subscribeToUser(currentUser.id, (dbUser) => {
      if (dbUser) {
        setCurrentUser(prev => prev ? { ...prev, ...dbUser } : dbUser);
      }
    });
    
    return () => unsubscribe();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      db.updateHeartbeat(currentUser.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('current_user', JSON.stringify(user));
    db.updateHeartbeat(user.id);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
  };

  const updateCurrentUser = (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    localStorage.setItem('current_user', JSON.stringify(updated));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Blocking Overlay
  if (currentUser?.isBlocked) {
    return (
      <div className="fixed inset-0 z-[999] bg-red-600/90 backdrop-blur-md flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl p-8 max-w-md shadow-2xl animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-user-lock text-4xl"></i>
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Аккаунт заблокирован</h1>
          <p className="text-slate-500 mb-6 font-medium leading-relaxed">
            Ваш доступ к приложению временно ограничен администратором системы.
          </p>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8">
            <p className="text-[11px] text-red-400 font-bold uppercase tracking-widest mb-1 text-left">Причина блокировки:</p>
            <p className="text-red-700 font-bold text-left italic">
              "{currentUser.blockReason || 'Причина не указана'}"
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-800 text-white py-3.5 rounded-2xl font-bold hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50 overflow-hidden">
      {!currentUser ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <MainLayout 
          currentUser={currentUser} 
          onLogout={handleLogout} 
          onUserUpdate={updateCurrentUser}
        />
      )}
    </div>
  );
};

export default App;
