
import React, { useState, useEffect } from 'react';
import { User } from './types';
import Auth from './components/Auth';
import MainLayout from './components/MainLayout';
import { db } from './services/db';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  // Sync current user status from DB in real-time
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

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
      <div className={`flex items-center justify-center h-screen ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Blocking Overlay
  if (currentUser?.isBlocked) {
    return (
      <div className={`fixed inset-0 z-[999] ${theme === 'dark' ? 'bg-slate-950/95' : 'bg-red-600/90'} backdrop-blur-md flex items-center justify-center p-6 text-center`}>
        <div className={`${theme === 'dark' ? 'bg-slate-900' : 'bg-white'} rounded-3xl p-8 max-w-md shadow-2xl animate-in zoom-in duration-300 border ${theme === 'dark' ? 'border-slate-800' : 'border-transparent'}`}>
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-user-lock text-4xl"></i>
          </div>
          <h1 className={`text-2xl font-black ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'} mb-2 uppercase tracking-tight`}>Аккаунт заблокирован</h1>
          <p className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} mb-6 font-medium leading-relaxed`}>
            Ваш доступ к приложению временно ограничен администратором системы.
          </p>
          <div className={`${theme === 'dark' ? 'bg-red-900/10 border-red-900/20' : 'bg-red-50 border-red-100'} border rounded-xl p-4 mb-8`}>
            <p className="text-[11px] text-red-400 font-bold uppercase tracking-widest mb-1 text-left">Причина блокировки:</p>
            <p className="text-red-700 dark:text-red-400 font-bold text-left italic">
              "{currentUser.blockReason || 'Причина не указана'}"
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className={`w-full ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'} text-white py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none`}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen ${theme === 'dark' ? 'bg-slate-950 dark text-slate-100' : 'bg-slate-50 text-slate-900'} overflow-hidden transition-colors duration-300`}>
      <div className={theme}>
        {!currentUser ? (
          <Auth onLogin={handleLogin} theme={theme} />
        ) : (
          <MainLayout 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            onUserUpdate={updateCurrentUser}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}
      </div>
    </div>
  );
};

export default App;
