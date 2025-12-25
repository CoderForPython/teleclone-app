
import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { db } from '../services/db';

interface ChatWindowProps {
  targetUser: User;
  currentUser: User;
  onBack: () => void;
}

const COMMON_EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '🎉', '🤔', '🙌', '😎', '😢', '❤️', '✨', '🚀', '👋', '💯'];

const ChatWindow: React.FC<ChatWindowProps> = ({ targetUser, currentUser, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convId = db.getConversationId(currentUser.id, targetUser.id);

  const isOnline = db.isOnline(targetUser);
  const lastSeenText = targetUser.lastSeen 
    ? `last seen ${new Date(targetUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'offline';

  // Real-time message subscription
  useEffect(() => {
    const unsubscribe = db.subscribeToMessages(convId, (newMessages) => {
      setMessages(newMessages);
    });
    return () => unsubscribe();
  }, [convId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string, file?: Message['file']) => {
    if (!text.trim() && !file) return;

    // Firebase Realtime Database does not accept 'undefined' values.
    // We construct the object carefully to avoid keys with undefined values.
    const newMessage: any = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      text: text,
      timestamp: Date.now(),
      status: 'sent'
    };

    if (file) {
      newMessage.file = file;
    }

    try {
      await db.saveMessage(convId, newMessage as Message);
      setInputText('');
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

  return (
    <div className="flex flex-col h-full bg-white relative w-full overflow-hidden">
      <div className="p-3 md:p-4 bg-white border-b border-slate-200 flex items-center space-x-2 md:space-x-4 shadow-sm z-20">
        <button onClick={onBack} className="md:hidden text-slate-500 hover:text-blue-500 p-2 -ml-2 transition-colors">
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <img src={targetUser.avatar} className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border border-slate-100" alt={targetUser.username} />
        <div className="flex-grow min-w-0">
          <h2 className="font-bold text-slate-800 leading-tight truncate text-sm md:text-base">{targetUser.username}</h2>
          <span className={`text-[10px] md:text-[11px] font-medium ${isOnline ? 'text-blue-500' : 'text-slate-400'}`}>
            {isOnline ? 'online' : lastSeenText}
          </span>
        </div>
        <div className="flex items-center space-x-3 md:space-x-5 text-slate-400">
          <button className="hover:text-blue-500 transition-colors"><i className="fa-solid fa-phone text-lg"></i></button>
          <button className="hover:text-blue-500 transition-colors"><i className="fa-solid fa-ellipsis-vertical text-lg"></i></button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-3 md:p-4 space-y-3 bg-[#e5ddd5] relative">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[url('https://i.pinimg.com/originals/85/70/f6/8570f6339d318933ef0c0f86641e7f6e.jpg')] bg-repeat bg-center"></div>
        <div className="relative z-10 flex flex-col space-y-3">
          {messages.map((msg) => {
            const isOwn = msg.senderId === currentUser.id;
            const isImage = msg.file?.type.startsWith('image/');
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl relative shadow-sm group overflow-hidden ${isOwn ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'} ${isImage ? 'p-1' : 'px-3 py-1.5'}`}>
                  {isImage && msg.file && (
                    <div className="relative overflow-hidden rounded-xl">
                      <img src={msg.file.data} className="max-w-full h-auto max-h-[60vh] md:max-h-96 rounded-xl object-contain block" alt={msg.file.name} />
                      <button onClick={() => downloadFile(msg.file!.data, msg.file!.name)} className="absolute top-2 right-2 bg-black/40 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 transform"><i className="fa-solid fa-download text-xs"></i></button>
                    </div>
                  )}
                  {!isImage && msg.file && (
                    <div className="flex items-center space-x-3 my-1">
                      {isOwn ? null : getFileIcon(msg.file.type)}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate max-w-[150px] md:max-w-[180px]">{msg.file.name}</span>
                        <span className={`text-[10px] ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>{(msg.file.size / 1024).toFixed(1)} KB</span>
                      </div>
                      {isOwn ? getFileIcon(msg.file.type) : null}
                      <button onClick={() => downloadFile(msg.file!.data, msg.file!.name)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}><i className="fa-solid fa-arrow-down text-sm"></i></button>
                    </div>
                  )}
                  {msg.text && <p className={`text-[14px] leading-relaxed whitespace-pre-wrap ${isImage ? 'mt-2 px-2 pb-1' : ''}`}>{msg.text}</p>}
                  <div className={`text-[9px] mt-0.5 flex items-center justify-end space-x-1 ${isImage ? 'absolute bottom-2 right-3 bg-black/30 px-1.5 py-0.5 rounded-full text-white' : (isOwn ? 'text-blue-100' : 'text-slate-400')}`}>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isOwn && <i className="fa-solid fa-check-double text-[8px]"></i>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {showEmojiPicker && (
        <div className="absolute bottom-20 left-2 right-2 md:left-4 md:right-auto bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="grid grid-cols-5 gap-2">
            {COMMON_EMOJIS.map(emoji => (
              <button key={emoji} type="button" onClick={() => { setInputText(prev => prev + emoji); setShowEmojiPicker(false); }} className="text-2xl hover:bg-slate-50 p-2 rounded-xl transition-all active:scale-90">{emoji}</button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 md:p-4 bg-white border-t border-slate-200 z-10">
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }} className="flex items-center space-x-2 md:space-x-3">
          <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-blue-500 transition-colors p-2"><i className="fa-solid fa-paperclip text-xl"></i></button>
          <div className="flex-grow relative">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Write a message..." className="w-full bg-slate-100 border border-transparent rounded-2xl py-2.5 md:py-3 px-4 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 outline-none transition-all pr-10 text-sm text-slate-900 font-medium placeholder:text-slate-400" />
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`absolute right-2 top-1/2 -translate-y-1/2 transition-colors ${showEmojiPicker ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}><i className="fa-regular fa-face-smile text-xl"></i></button>
          </div>
          <button type="submit" disabled={!inputText.trim()} className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${inputText.trim() ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 active:scale-95' : 'bg-slate-100 text-slate-300'}`}><i className="fa-solid fa-paper-plane text-lg ml-0.5"></i></button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
