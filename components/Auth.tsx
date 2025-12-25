
import React, { useState } from 'react';
import { db } from '../services/db';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isLogin) {
      const user = db.findUserByUsername(username);
      if (user && user.password === password) {
        onLogin(user);
      } else {
        setError('Invalid username or password');
      }
    } else {
      const existing = db.findUserByUsername(username);
      if (existing) {
        setError('Username already exists');
        return;
      }
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        username,
        password,
        status: 'online',
        avatar: `https://picsum.photos/seed/${username}/200`
      };
      db.saveUser(newUser);
      onLogin(newUser);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-paper-plane text-4xl"></i>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">TeleClone AI</h1>
          <p className="mt-2 text-slate-500">Secure. Fast. AI Powered.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 mt-1 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 mt-1 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
          >
            {isLogin ? 'Log In' : 'Sign Up'}
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
