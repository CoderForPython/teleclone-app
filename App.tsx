
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

  // Heartbeat to keep user "Online"
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      db.updateHeartbeat(currentUser.id);
    }, 5000); // Update every 5 seconds

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50 overflow-hidden">
      {!currentUser ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <MainLayout currentUser={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
