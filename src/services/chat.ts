import {
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  doc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Unsubscribe,
  increment,
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { Chat, LastMessage, Message, MessageContent, MessageType } from '../types';

type SendMessageInput = {
  chatId: string;
  senderId: string;
  type?: MessageType;
  content: MessageContent;
};

type DirectChatOptions = {
  type?: 'rental' | 'general';
  rentalId?: string;
  itemId?: string;
  metadata?: Partial<Chat['metadata']>;
};

const CHATS = collections.chats;

/**
 * Helper: stable key for a set of participants (sorted)
 */
const buildParticipantsKey = (uids: string[]) => [...uids].sort().join(':');

/**
 * Mapping helpers: Firestore Timestamps -> JS Date
 */
const toDate = (val: any): Date | undefined => {
  if (!val) return undefined;
  // Firestore Timestamp has toDate()
  return typeof val.toDate === 'function' ? val.toDate() : new Date(val);
};

const mapChatDoc = (id: string, data: any): Chat => {
  const last: LastMessage = {
    text: data.lastMessage?.text || '',
    senderId: data.lastMessage?.senderId || '',
    timestamp: toDate(data.lastMessage?.timestamp) as Date,
    type: data.lastMessage?.type || 'text',
  };
  return {
    id,
    participants: data.participants || [],
    type: data.type || 'general',
    rentalId: data.rentalId,
    itemId: data.itemId,
    lastMessage: last,
    metadata: {
      unreadCount: data.metadata?.unreadCount || {},
      isActive: data.metadata?.isActive ?? true,
      blockedBy: data.metadata?.blockedBy || [],
    },
    createdAt: toDate(data.createdAt) as Date,
    updatedAt: toDate(data.updatedAt) as Date,
  };
};

const mapMessageDoc = (id: string, data: any): Message => {
  return {
    id,
    senderId: data.senderId,
    type: data.type || 'text',
    content: data.content || {},
    status: {
      sent: toDate(data.status?.sent) as Date,
      delivered: toDate(data.status?.delivered),
      read: toDate(data.status?.read),
    },
    metadata: data.metadata,
    timestamp: toDate(data.timestamp) as Date,
  };
};

export class ChatService {
  /**
   * Find an existing chat by participantsKey (and optional rentalId/type)
   */
  static async findChatByParticipants(
    participants: string[],
    opts?: { type?: 'rental' | 'general'; rentalId?: string }
  ): Promise<Chat | null> {
    const participantsKey = buildParticipantsKey(participants);
    const constraints: any[] = [where('participantsKey', '==', participantsKey)];
    if (opts?.type) constraints.push(where('type', '==', opts.type));
    if (opts?.rentalId) constraints.push(where('rentalId', '==', opts.rentalId));

    const q = query(collection(db, CHATS), ...constraints, limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return mapChatDoc(d.id, d.data());
  }

  /**
   * Create a new chat
   */
  static async createChat(
    participants: string[],
    opts?: DirectChatOptions
  ): Promise<Chat> {
    const participantsKey = buildParticipantsKey(participants);
    const chatPayload: any = {
      participants,
      participantsKey,
      type: opts?.type || 'general',
      rentalId: opts?.rentalId || null,
      itemId: opts?.itemId || null,
      lastMessage: {
        text: '',
        senderId: '',
        timestamp: serverTimestamp(),
        type: 'text',
      },
      metadata: {
        unreadCount: {},
        isActive: true,
        ...(opts?.metadata || {}),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = await addDoc(collection(db, CHATS), chatPayload);
    const docSnap = await getDoc(ref);
    return mapChatDoc(docSnap.id, docSnap.data());
  }

  /**
   * Get or create a direct chat between two users
   */
  static async getOrCreateDirectChat(
    currentUserId: string,
    otherUserId: string,
    opts?: DirectChatOptions
  ): Promise<Chat> {
    const participants = [currentUserId, otherUserId];
    const existing = await this.findChatByParticipants(participants, {
      type: opts?.type,
      rentalId: opts?.rentalId,
    });
    if (existing) return existing;
    return this.createChat(participants, opts);
  }

  /**
   * Subscribe to a chat doc
   */
  static subscribeToChat(chatId: string, callback: (chat: Chat | null) => void): Unsubscribe {
    const chatRef = doc(db, CHATS, chatId);
    return onSnapshot(
      chatRef,
      (snap) => {
        if (!snap.exists()) return callback(null);
        callback(mapChatDoc(snap.id, snap.data()));
      },
      (err) => console.error('subscribeToChat error:', err)
    );
  }

  /**
   * Subscribe to messages in a chat
   */
  static subscribeToMessages(
    chatId: string,
    callback: (messages: Message[]) => void
  ): Unsubscribe {
    const msgsRef = collection(db, CHATS, chatId, 'messages');
    const q = query(msgsRef, orderBy('timestamp', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((d) => mapMessageDoc(d.id, d.data()));
        callback(msgs);
      },
      (err) => console.error('subscribeToMessages error:', err)
    );
  }

  /**
   * Send a message to a chat (text/image/etc) with lastMessage + unread updates
   */
  static async sendMessage(input: SendMessageInput): Promise<string> {
    const { chatId, senderId, content, type = 'text' } = input;

    const msgRef = await addDoc(collection(db, CHATS, chatId, 'messages'), {
      senderId,
      type,
      content,
      status: {
        sent: serverTimestamp(),
      },
      timestamp: serverTimestamp(),
    });

    // Update chat lastMessage and updatedAt, and bump unread counts for non-sender participants
    const chatRef = doc(db, CHATS, chatId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const chatData = chatSnap.data() as any;
      const participants: string[] = chatData.participants || [];
      const updates: any = {
        lastMessage: {
          text: content.text || (content.imageUrl ? '[image]' : ''),
          senderId,
          timestamp: serverTimestamp(),
          type,
        },
        updatedAt: serverTimestamp(),
      };
      // Increment unread for all except sender
      participants
        .filter((uid) => uid !== senderId)
        .forEach((uid) => {
          updates[`metadata.unreadCount.${uid}`] = increment(1);
        });
      // Reset sender unread to 0 to avoid own unread increments
      updates[`metadata.unreadCount.${senderId}`] = 0;

      await updateDoc(chatRef, updates);
    }

    return msgRef.id;
  }

  /**
   * Mark all messages as read for a user in a chat (reset unread counter)
   */
  static async markAsRead(chatId: string, userId: string): Promise<void> {
    const chatRef = doc(db, CHATS, chatId);
    await updateDoc(chatRef, {
      [`metadata.unreadCount.${userId}`]: 0,
      updatedAt: serverTimestamp(),
    });
  }
}

export default ChatService;
