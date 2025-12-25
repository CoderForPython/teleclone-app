
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, get, update } from "firebase/database";
import { User, Message } from '../types';

// Конфигурация твоего проекта teleclone-69115
const firebaseConfig = {
  apiKey: process.env.API_KEY, 
  authDomain: "teleclone-69115.firebaseapp.com",
  databaseURL: "https://teleclone-69115-default-rtdb.firebaseio.com",
  projectId: "teleclone-69115",
  storageBucket: "teleclone-69115.appspot.com",
  messagingSenderId: "1046522299138",
  appId: "1:1046522299138:web:715c0e101f3f7e1b"
};

// Инициализация синглтона
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

// Utility to remove undefined values from objects (Firebase doesn't allow them)
const cleanObject = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

export const db = {
  // --- USER METHODS ---
  
  async saveUser(user: User) {
    try {
      await set(ref(database, 'users/' + user.id), cleanObject(user));
    } catch (e) {
      console.error("Firebase saveUser error:", e);
      throw e;
    }
  },

  async findUserByUsername(username: string): Promise<User | undefined> {
    try {
      const snapshot = await get(ref(database, 'users'));
      if (snapshot.exists()) {
        const users = snapshot.val();
        return Object.values(users).find((u: any) => u.username === username) as User;
      }
    } catch (e) {
      console.error("Firebase findUser error:", e);
    }
    return undefined;
  },

  updateHeartbeat(userId: string) {
    if (!userId) return;
    const userRef = ref(database, `users/${userId}`);
    update(userRef, { lastSeen: Date.now() }).catch(e => console.error("Heartbeat error:", e));
  },

  subscribeToUsers(callback: (users: User[]) => void) {
    const usersRef = ref(database, 'users');
    return onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(Object.values(snapshot.val()));
      } else {
        callback([]);
      }
    }, (error) => {
      console.error("Subscribe users error:", error);
    });
  },

  isOnline(user: User): boolean {
    if (!user || !user.lastSeen) return false;
    return (Date.now() - user.lastSeen) < 15000;
  },

  // --- CHAT METHODS ---

  getConversationId(id1: string, id2: string): string {
    return [id1, id2].sort().join('--');
  },

  async saveMessage(chatId: string, message: Message) {
    try {
      const messagesRef = ref(database, `messages/${chatId}`);
      const newMessageRef = push(messagesRef);
      const cleanedMessage = cleanObject(message);
      await set(newMessageRef, cleanedMessage);
      await set(ref(database, `lastMessages/${chatId}`), cleanedMessage);
    } catch (e) {
      console.error("Firebase saveMessage error:", e);
      throw e;
    }
  },

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    const messagesRef = ref(database, `messages/${chatId}`);
    return onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Превращаем объект сообщений в массив
        const msgList = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        // Sort messages by timestamp just in case
        msgList.sort((a, b) => a.timestamp - b.timestamp);
        callback(msgList);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error("Subscribe messages error:", error);
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
    }, (error) => {
      console.error("Subscribe lastMessages error:", error);
    });
  }
};
