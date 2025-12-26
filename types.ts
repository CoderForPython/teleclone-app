
export interface User {
  id: string;
  username: string;
  password?: string;
  avatar?: string;
  status: 'online' | 'offline';
  lastSeen?: number; // Numeric timestamp for real-time tracking
  isBlocked?: boolean;
  blockReason?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
  file?: {
    name: string;
    data: string; // base64 string
    type: string;
    size: number;
  };
}

export interface Chat {
  id: string;
  participants: string[]; // User IDs
  lastMessage?: Message;
  type: 'private' | 'group' | 'ai';
  title?: string;
}

export interface CallData {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  status: 'ringing' | 'accepted' | 'rejected' | 'ended';
  offer?: any;
  answer?: any;
  timestamp: number;
}
