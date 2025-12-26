
import React, { useState } from 'react';
import { db } from '../services/db';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
  theme: 'light' | 'dark';
}

const Auth: React.FC<AuthProps> = ({ onLogin, theme }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDark = theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const user = await db.findUserByUsername(username);
        if (user && user.password === password) {
          onLogin(user);
        } else {
          setError('Invalid username or password');
        }
      } else {
        const existing = await db.findUserByUsername(username);
        if (existing) {
          setError('Username already exists');
          setLoading(false);
          return;
        }
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          username,
          password,
          status: 'online',
          avatar: `https://picsum.photos/seed/${username}/200`,
          lastSeen: Date.now()
        };
        await db.saveUser(newUser);
        onLogin(newUser);
      }
    } catch (err) {
      setError('Connection error. Check your Firebase settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen p-4 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`w-full max-w-md p-8 space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} rounded-2xl shadow-xl border`}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 ${isDark ? 'bg-blue-600' : 'bg-blue-500'} rounded-full flex items-center justify-center text-white shadow-lg`}>
              <i className="fa-solid fa-paper-plane text-4xl"></i>
            </div>
          </div>
          <h1 className="text-3xl font-bold">TeleClone App</h1>
          <p className={`mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Live Realtime Chat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-4 py-3 mt-1 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 focus:ring-blue-500' : 'bg-white border-slate-200 focus:ring-blue-500'} border rounded-xl outline-none transition-all`}
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 mt-1 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100 focus:ring-blue-500' : 'bg-white border-slate-200 focus:ring-blue-500'} border rounded-xl outline-none transition-all`}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 ${isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] ${loading ? 'opacity-50' : ''}`}
          >
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-500 hover:text-blue-600 font-medium transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
