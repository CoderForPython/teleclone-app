
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface AdminPanelProps {
  users: User[];
  currentUser: User;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ users, currentUser, onClose }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Filter out the bot and current user
  const targetUsers = users.filter(u => u.id !== currentUser.id && u.id !== 'bot_support');
  const selectedUser = targetUsers.find(u => u.id === selectedUserId);

  useEffect(() => {
    if (selectedUser) {
      setNewName(selectedUser.username || '');
      setBlockReason(selectedUser.blockReason || '');
    } else {
      setNewName('');
      setNewPassword('');
      setBlockReason('');
    }
  }, [selectedUserId, selectedUser]);

  const handleUpdateUser = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const updates: Partial<User> = {};
      if (newName.trim()) updates.username = newName.trim();
      if (newPassword.trim()) updates.password = newPassword.trim();
      
      await db.updateUser(selectedUserId, updates);
      alert('Данные успешно обновлены');
      setNewPassword('');
    } catch (e) {
      console.error("Update error:", e);
      alert('Ошибка при обновлении данных');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      if (selectedUser?.isBlocked) {
        const success = await db.adminUnblockUser(selectedUserId);
        if (success) alert('Пользователь разблокирован');
      } else {
        if (!blockReason.trim()) {
          alert('Пожалуйста, укажите причину блокировки');
          setLoading(false);
          return;
        }
        const success = await db.adminBlockUser(selectedUserId, blockReason.trim());
        if (success) alert('Пользователь заблокирован');
      }
    } catch (e) {
      console.error("Block/Unblock error:", e);
      alert('Ошибка при изменении статуса блокировки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-user-shield text-xl"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-800">Панель Администратора</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <section>
            <label className="block text-sm font-bold text-slate-700 mb-2">Выберите пользователя</label>
            <select 
              value={selectedUserId} 
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl py-3 px-4 focus:border-blue-500 outline-none transition-all text-black font-bold appearance-none"
              style={{ color: 'black' }}
            >
              <option value="" style={{ color: 'black' }}>-- Выберите юзера --</option>
              {targetUsers.map(u => (
                <option key={u.id} value={u.id} style={{ color: 'black' }}>
                  {u.username} {u.isBlocked ? '[ЗАБЛОКИРОВАН]' : ''}
                </option>
              ))}
            </select>
          </section>

          {selectedUserId && (
            <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
              {/* Profile Settings */}
              <section className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Настройки профиля</label>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">Имя пользователя (Логин)</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={loading}
                    placeholder="Новое имя"
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500 outline-none text-black font-semibold"
                    style={{ color: 'black' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">Новый пароль</label>
                  <input 
                    type="text" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    placeholder="Укажите новый пароль или оставьте пустым"
                    className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-blue-500 outline-none text-black font-semibold"
                    style={{ color: 'black' }}
                  />
                </div>

                <button 
                  onClick={handleUpdateUser}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center active:scale-95"
                >
                  {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Сохранить изменения'}
                </button>
              </section>

              {/* Block Management */}
              <section className={`p-4 rounded-xl border transition-colors ${selectedUser?.isBlocked ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-3 ${selectedUser?.isBlocked ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedUser?.isBlocked ? 'Разблокировка' : 'Блокировка аккаунта'}
                </label>
                
                {!selectedUser?.isBlocked && (
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-red-400 mb-1 ml-1 uppercase">Причина блокировки</label>
                    <textarea 
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      disabled={loading}
                      placeholder="Напр.: Нарушение правил общения..."
                      className="w-full bg-white border border-red-200 rounded-lg py-2 px-3 focus:ring-2 focus:ring-red-500 outline-none text-black font-medium text-sm h-20 resize-none"
                    />
                  </div>
                )}

                {selectedUser?.isBlocked && (
                  <div className="mb-4 p-3 bg-white rounded-lg border border-green-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Текущая причина:</p>
                    <p className="text-slate-700 font-semibold italic text-sm">"{selectedUser.blockReason}"</p>
                  </div>
                )}

                <button 
                  onClick={handleToggleBlock}
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 ${
                    selectedUser?.isBlocked 
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-100' 
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-red-200'
                  }`}
                >
                  {loading ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    selectedUser?.isBlocked ? 'Разблокировать' : 'Заблокировать навсегда'
                  )}
                </button>
              </section>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold italic">Используйте команду "AdminSupport" в чате с ботом для доступа</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
