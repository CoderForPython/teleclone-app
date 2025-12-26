
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, get, update, remove, onChildAdded } from "firebase/database";
import { User, Message, CallData } from '../types';

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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

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

  async updateUser(userId: string, updates: Partial<User>) {
    try {
      await update(ref(database, 'users/' + userId), cleanObject(updates));
    } catch (e) {
      console.error("Firebase updateUser error:", e);
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
    });
  },

  subscribeToUser(userId: string, callback: (user: User | null) => void) {
    const userRef = ref(database, `users/${userId}`);
    return onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    });
  },

  isOnline(user: User): boolean {
    if (!user || !user.lastSeen) return false;
    return (Date.now() - user.lastSeen) < 15000;
  },

  // --- ADMIN METHODS ---
  async adminBlockUser(userId: string, reason: string) {
    try {
      await update(ref(database, `users/${userId}`), {
        isBlocked: true,
        blockReason: reason
      });
      return true;
    } catch (e) {
      console.error("Block user error:", e);
      return false;
    }
  },

  async adminUnblockUser(userId: string) {
    try {
      await update(ref(database, `users/${userId}`), {
        isBlocked: false,
        blockReason: null
      });
      return true;
    } catch (e) {
      console.error("Unblock user error:", e);
      return false;
    }
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
      const msgId = newMessageRef.key || message.id;
      const finalMessage = { ...cleanedMessage, id: msgId };
      
      await set(newMessageRef, finalMessage);
      await set(ref(database, `lastMessages/${chatId}`), finalMessage);
    } catch (e) {
      console.error("Firebase saveMessage error:", e);
      throw e;
    }
  },

  async deleteMessages(chatId: string, messageIds: string[]) {
    try {
      const updates: any = {};
      messageIds.forEach(id => {
        updates[`messages/${chatId}/${id}`] = null;
      });
      
      await update(ref(database), updates);
      
      const messagesRef = ref(database, `messages/${chatId}`);
      const snapshot = await get(messagesRef);
      let lastMsg = null;
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgList = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        msgList.sort((a, b) => b.timestamp - a.timestamp);
        if (msgList.length > 0) {
          lastMsg = msgList[0];
        }
      }

      if (lastMsg) {
        await set(ref(database, `lastMessages/${chatId}`), lastMsg);
      } else {
        await remove(ref(database, `lastMessages/${chatId}`));
      }
    } catch (e) {
      console.error("Firebase deleteMessages error:", e);
      throw e;
    }
  },

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    const messagesRef = ref(database, `messages/${chatId}`);
    return onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgList = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        msgList.sort((a, b) => a.timestamp - b.timestamp);
        callback(msgList);
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
  },

  // --- CALL METHODS ---
  async initiateCall(callData: CallData) {
    const callRef = ref(database, `calls/${callData.receiverId}`);
    await set(callRef, cleanObject(callData));
  },

  async updateCall(receiverId: string, updates: Partial<CallData>) {
    const callRef = ref(database, `calls/${receiverId}`);
    await update(callRef, cleanObject(updates));
  },

  async endCall(receiverId: string) {
    const callRef = ref(database, `calls/${receiverId}`);
    await remove(callRef);
    await remove(ref(database, `calls/active/${receiverId}`));
  },

  subscribeToIncomingCall(userId: string, callback: (call: CallData | null) => void) {
    const callRef = ref(database, `calls/${userId}`);
    return onValue(callRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    });
  },

  async sendIceCandidate(callId: string, side: 'caller' | 'receiver', candidate: any) {
    const candidatesRef = ref(database, `calls/candidates/${callId}/${side}`);
    await push(candidatesRef, cleanObject(candidate.toJSON()));
  },

  subscribeToIceCandidates(callId: string, side: 'caller' | 'receiver', callback: (candidate: any) => void) {
    const candidatesRef = ref(database, `calls/candidates/${callId}/${side}`);
    return onChildAdded(candidatesRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });
  }
};
