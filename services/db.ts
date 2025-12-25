
import { User, Message } from '../types';

const USERS_KEY = 'teleclone_users';
const MESSAGES_KEY = 'teleclone_messages_';

const initDefaults = () => {
  const data = localStorage.getItem(USERS_KEY);
  let users: User[] = data ? JSON.parse(data) : [];
  
  const defaults = [
    { id: 'admin-id', username: 'admin', password: 'admin', status: 'offline', lastSeen: 0, avatar: 'https://picsum.photos/seed/admin/200' },
    { id: 'admin2-id', username: 'admin2', password: 'admin2', status: 'offline', lastSeen: 0, avatar: 'https://picsum.photos/seed/admin2/200' }
  ];

  let changed = false;
  defaults.forEach(def => {
    if (!users.find(u => u.username === def.username)) {
      users.push(def as User);
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};

initDefaults();

export const db = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: (user: User) => {
    const users = db.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  updateHeartbeat: (userId: string) => {
    const users = db.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index].lastSeen = Date.now();
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  },

  isOnline: (user: User): boolean => {
    if (!user.lastSeen) return false;
    // Consider online if seen in the last 15 seconds
    return (Date.now() - user.lastSeen) < 15000;
  },

  findUserByUsername: (username: string): User | undefined => {
    return db.getUsers().find(u => u.username === username);
  },

  getConversationId: (id1: string, id2: string): string => {
    return [id1, id2].sort().join('--');
  },

  getMessages: (chatId: string): Message[] => {
    const data = localStorage.getItem(MESSAGES_KEY + chatId);
    return data ? JSON.parse(data) : [];
  },

  saveMessage: (chatId: string, message: Message) => {
    const messages = db.getMessages(chatId);
    messages.push(message);
    localStorage.setItem(MESSAGES_KEY + chatId, JSON.stringify(messages));
  },

  getLastMessage: (chatId: string): Message | undefined => {
    const messages = db.getMessages(chatId);
    return messages.length > 0 ? messages[messages.length - 1] : undefined;
  }
};
