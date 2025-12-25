
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, get, update, child } from "firebase/database";
import { User, Message } from '../types';

// Конфигурация обновлена данными твоего проекта teleclone-69115
const firebaseConfig = {
  apiKey: process.env.API_KEY, 
  authDomain: "teleclone-69115.firebaseapp.com",
  databaseURL: "https://teleclone-69115-default-rtdb.firebaseio.com/",
  projectId: "teleclone-69115",
  storageBucket: "teleclone-69115.appspot.com",
  messagingSenderId: "1046522299138",
  appId: "1:1046522299138:web:teleclone"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export const db = {
  // --- USER METHODS ---
  
  async saveUser(user: User) {
    await set(ref(database, 'users/' + user.id), user);
  },

  async findUserByUsername(username: string): Promise<User | undefined> {
    const snapshot = await get(ref(database, 'users'));
    if (snapshot.exists()) {
      const users = snapshot.val();
      return Object.values(users).find((u: any) => u.username === username) as User;
    }
    return undefined;
  },

  updateHeartbeat(userId: string) {
    const userRef = ref(database, `users/${userId}`);
    update(userRef, { lastSeen: Date.now() });
  },

  subscribeToUsers(callback: (users: User[]) => void) {
    const usersRef = ref(database, 'users');
    return onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(Object.values(snapshot.val()));
      } else {
        callback([]);
      }
    });
  },

  isOnline(user: User): boolean {
    if (!user.lastSeen) return false;
    // Считаем пользователя онлайн, если он обновлял статус в последние 15 секунд
    return (Date.now() - user.lastSeen) < 15000;
  },

  // --- CHAT METHODS ---

  getConversationId(id1: string, id2: string): string {
    return [id1, id2].sort().join('--');
  },

  async saveMessage(chatId: string, message: Message) {
    const messagesRef = ref(database, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, message);
    
    // Сохраняем последнее сообщение для превью в сайдбаре
    await set(ref(database, `lastMessages/${chatId}`), message);
  },

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    const messagesRef = ref(database, `messages/${chatId}`);
    return onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(Object.values(snapshot.val()));
      } else {
        callback([]);
      }
    });
  },

  subscribeToLastMessages(callback: (lastMsgs: Record<string, Message>) => void) {
    const ref_ = ref(database, 'lastMessages');
    return onValue(ref_, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback({});
      }
    });
  }
};
