
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Message } from '../types';
import { db } from '../services/db';

interface ChatWindowProps {
  targetUser: User;
  currentUser: User;
  onBack: () => void;
  onStartCall: () => void;
  onOpenAdmin?: () => void;
  theme: 'light' | 'dark';
}

const ChatWindow: React.FC<ChatWindowProps> = ({ targetUser, currentUser, onBack, onStartCall, onOpenAdmin, theme }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => localStorage.getItem(`admin_${currentUser.id}`) === 'true');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const convId = useMemo(() => db.getConversationId(currentUser.id, targetUser.id), [currentUser.id, targetUser.id]);

  const isOnline = targetUser.id === 'bot_support' ? true : db.isOnline(targetUser);
  const lastSeenText = targetUser.id === 'bot_support' 
    ? 'online' 
    : (targetUser.lastSeen 
        ? `last seen ${new Date(targetUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'offline');

  useEffect(() => {
    const unsubscribe = db.subscribeToMessages(convId, (newMessages) => {
      setMessages(newMessages);
    });
    return () => unsubscribe();
  }, [convId]);

  useEffect(() => {
    if (!selectionMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectionMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleSendMessage = async (text: string, file?: Message['file']) => {
    if (!text.trim() && !file) return;

    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      text: text,
      timestamp: Date.now(),
      status: 'sent',
      file: file
    };

    try {
      await db.saveMessage(convId, newMessage);
      setInputText('');

      if (targetUser.id === 'bot_support' && text.trim() === 'AdminSupport') {
        setIsAdminUnlocked(true);
        localStorage.setItem(`admin_${currentUser.id}`, 'true');
      }

      if (targetUser.id === 'bot_support') {
        setTimeout(async () => {
          const botReplyText = text.trim() === 'AdminSupport' 
            ? 'Команда AdminSupport принята. Панель админа теперь доступна в меню чата.'
            : 'Я не знаю такой команды.';
            
          const botReply: Message = {
            id: Math.random().toString(36).substr(2, 9),
            senderId: 'bot_support',
            text: botReplyText,
            timestamp: Date.now(),
            status: 'sent'
          };
          await db.saveMessage(convId, botReply);
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      handleSendMessage('', {
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64Data
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const downloadFile = (data: string, name: string) => {
    const link = document.createElement('a');
    link.href = data;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <i className="fa-solid fa-file-pdf text-red-500 text-2xl"></i>;
    if (type.includes('word') || type.includes('text')) return <i className="fa-solid fa-file-lines text-blue-500 text-2xl"></i>;
    if (type.includes('zip') || type.includes('rar')) return <i className="fa-solid fa-file-zipper text-yellow-600 text-2xl"></i>;
    return <i className="fa-solid fa-file text-slate-400 text-2xl"></i>;
  };

  const toggleSelection = (id: string) => {
    if (!selectionMode) return;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(new Set(newSelected));
  };

  const startSelectionMode = () => {
    setSelectionMode(true);
    setShowMenu(false);
    setSelectedIds(new Set());
  };

  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const deleteSelectedMessages = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await db.deleteMessages(convId, Array.from(selectedIds));
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить сообщения");
    } finally {
      setIsDeleting(false);
    }
  };

  const isCallDisabled = targetUser.callsDisabled || targetUser.id === 'bot_support';

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} relative w-full overflow-hidden`}>
      {/* Header */}
      <div className={`p-3 md:p-4 border-b ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} flex items-center space-x-2 md:space-x-4 shadow-sm z-20`}>
        <button onClick={onBack} className="md:hidden text-slate-500 hover:text-blue-500 p-2 -ml-2 transition-colors">
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <img src={targetUser.avatar} className={`w-9 h-9 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0`} alt={targetUser.username} />
        <div className="flex-grow min-w-0">
          <h2 className="font-bold leading-tight truncate text-sm md:text-base">{targetUser.username}</h2>
          <span className={`text-[10px] md:text-[11px] font-medium ${isOnline ? 'text-blue-500' : 'text-slate-400'}`}>
            {isOnline ? 'online' : lastSeenText}
          </span>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          {selectionMode && (
            <div className="flex items-center space-x-1 md:space-x-2 mr-1">
              <button onClick={cancelSelectionMode} className={`px-2.5 py-1.5 md:px-3 rounded-lg ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} transition-colors text-xs md:text-sm font-semibold`}>
                Отмена
              </button>
              <button onClick={deleteSelectedMessages} disabled={selectedIds.size === 0 || isDeleting} className={`px-2.5 py-1.5 md:px-3 rounded-lg text-white font-semibold text-xs md:text-sm transition-all ${selectedIds.size > 0 ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-100' : 'bg-slate-300 cursor-not-allowed'}`}>
                {isDeleting ? '...' : 'Удалить'}
              </button>
            </div>
          )}

          <div className="flex items-center">
            <button 
              onClick={onStartCall}
              disabled={selectionMode || isCallDisabled}
              className={`transition-colors ${theme === 'dark' ? 'bg-slate-800' : 'bg-blue-50'} w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shadow-sm ${ (selectionMode || isCallDisabled) ? 'opacity-30 cursor-not-allowed' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-slate-700'}`}
              title={targetUser.callsDisabled ? "Звонки отключены пользователем" : "Аудиозвонок"}
            >
              <i className={`fa-solid ${targetUser.callsDisabled ? 'fa-phone-slash' : 'fa-phone'} text-sm md:text-base`}></i>
            </button>
          </div>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="text-slate-400 hover:text-blue-500 transition-colors p-2">
              <i className="fa-solid fa-ellipsis-vertical text-base md:text-lg"></i>
            </button>
            {showMenu && (
              <div className={`absolute right-0 mt-2 w-52 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-100 text-slate-700'} border shadow-2xl rounded-xl py-2 z-50 animate-in fade-in zoom-in duration-100`}>
                <button onClick={startSelectionMode} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-3 transition-colors`}>
                  <i className="fa-solid fa-trash-can text-slate-400"></i>
                  <span className="font-medium">Удалить сообщения</span>
                </button>
                {targetUser.id === 'bot_support' && isAdminUnlocked && (
                  <button onClick={() => { setShowMenu(false); onOpenAdmin?.(); }} className={`w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center space-x-3 transition-colors border-t ${theme === 'dark' ? 'border-slate-700' : 'border-slate-50'}`}>
                    <i className="fa-solid fa-user-shield"></i>
                    <span className="font-bold">Панель админа</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className={`flex-grow overflow-y-auto p-3 md:p-4 space-y-3 relative ${theme === 'dark' ? 'bg-slate-950' : 'bg-[#e5ddd5]'}`}>
        <div className={`absolute inset-0 ${theme === 'dark' ? 'opacity-[0.03]' : 'opacity-[0.08]'} pointer-events-none bg-[url('https://i.pinimg.com/originals/85/70/f6/8570f6339d318933ef0c0f86641e7f6e.jpg')] bg-repeat bg-center`}></div>
        <div className="relative z-10 flex flex-col space-y-3">
          {messages.map((msg) => {
            const isOwn = msg.senderId === currentUser.id;
            const isImage = msg.file?.type.startsWith('image/');
            const isSelected = selectedIds.has(msg.id);
            
            return (
              <div key={msg.id} className={`flex items-center w-full ${isOwn ? 'justify-end' : 'justify-start'} group relative`} onClick={() => selectionMode && toggleSelection(msg.id)}>
                {selectionMode && isOwn && (
                  <div className="mr-3 flex-shrink-0 cursor-pointer animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 bg-white shadow-inner'}`}>
                      {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                    </div>
                  </div>
                )}
                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl relative shadow-sm overflow-hidden flex flex-col transition-transform ${isOwn ? 'bg-blue-600 text-white rounded-tr-none' : (theme === 'dark' ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-white text-slate-800 border-slate-100') } border ${isImage ? 'p-1' : 'px-3 py-1.5'} ${selectionMode ? 'cursor-pointer active:scale-[0.98]' : ''}`}>
                  {isImage && msg.file && (
                    <div className="relative overflow-hidden rounded-xl">
                      <img src={msg.file.data} className="max-w-full h-auto max-h-[60vh] md:max-h-96 rounded-xl object-contain block" alt={msg.file.name} />
                      {!selectionMode && (
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(msg.file!.data, msg.file!.name); }} className="absolute top-2 right-2 bg-black/40 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 transform"><i className="fa-solid fa-download text-xs"></i></button>
                      )}
                    </div>
                  )}
                  {!isImage && msg.file && (
                    <div className="flex items-center space-x-3 my-1">
                      {isOwn ? null : getFileIcon(msg.file.type)}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate max-w-[150px] md:max-w-[180px]">{msg.file.name}</span>
                      </div>
                      {isOwn ? getFileIcon(msg.file.type) : null}
                      {!selectionMode && (
                        <button onClick={(e) => { e.stopPropagation(); downloadFile(msg.file!.data, msg.file!.name); }} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'}`}><i className="fa-solid fa-arrow-down text-sm"></i></button>
                      )}
                    </div>
                  )}
                  {msg.text && <p className={`text-[14px] leading-relaxed whitespace-pre-wrap ${isImage ? 'mt-2 px-2 pb-1' : ''}`}>{msg.text}</p>}
                  <div className={`text-[9px] mt-0.5 flex items-center justify-end space-x-1 ${isImage ? 'absolute bottom-2 right-3 bg-black/30 px-1.5 py-0.5 rounded-full text-white' : (isOwn ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500')}`}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isOwn && <i className="fa-solid fa-check-double text-[8px]"></i>}
                  </div>
                </div>
                {selectionMode && !isOwn && (
                  <div className="ml-3 flex-shrink-0 cursor-pointer animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 bg-white shadow-inner'}`}>
                      {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className={`p-3 md:p-4 border-t ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} z-10 transition-all ${selectionMode ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
        <div className="flex items-center space-x-2 md:space-x-3">
          <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-blue-500 transition-colors p-2 flex-shrink-0">
            <i className="fa-solid fa-paperclip text-xl"></i>
          </button>
          <div className="flex-grow relative">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)} placeholder="Напишите сообщение..." className={`w-full ${theme === 'dark' ? 'bg-slate-800 text-slate-100 placeholder:text-slate-500' : 'bg-slate-100 text-slate-900 placeholder:text-slate-400'} border border-transparent rounded-2xl py-2.5 md:py-3 px-4 focus:bg-white dark:focus:bg-slate-700 focus:border-blue-200 dark:focus:border-blue-900 outline-none transition-all pr-10 text-sm font-medium`} />
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`absolute right-2 top-1/2 -translate-y-1/2 transition-colors ${showEmojiPicker ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}>
              <i className="fa-regular fa-face-smile text-xl"></i>
            </button>
          </div>
          <button type="button" onClick={() => handleSendMessage(inputText)} disabled={!inputText.trim()} className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${inputText.trim() ? 'bg-blue-600 text-white shadow-lg active:scale-95' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed'}`}>
            <i className="fa-solid fa-paper-plane text-lg ml-0.5"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
