import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { Chat, Message, User, Item, Rental } from '../../types';
import ChatService, { mapChatDoc } from '../../services/chat';
import { db, collections } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ChatScreenProps {
  route: {
    params: {
      chatId?: string;
      rentalId?: string;
      otherUserId?: string;
      itemId?: string;
    };
  };
}

interface MessageWithUser extends Message {
  senderName: string;
  senderAvatar?: string;
}

const ChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatId, rentalId, otherUserId, itemId } = route.params as {
    chatId?: string;
    rentalId?: string;
    otherUserId?: string;
    itemId?: string;
  };
  const { user } = useAuthContext();

  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [messageText, setMessageText] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [rental, setRental] = useState<Rental | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      if (!user) {
        console.log('Chat: No user authenticated');
        return;
      }

      console.log('Chat: Initializing with user:', user.uid, 'otherUserId:', otherUserId);
      setLoading(true);

      // 1. Try to fetch other user from Firestore first
      let fetchedOther: User | null = null;
      if (otherUserId) {
        try {
          console.log('Chat: Fetching other user data...');
          const otherDoc = await getDoc(doc(db, collections.users, otherUserId));
          if (otherDoc.exists()) {
            const d = otherDoc.data();
            fetchedOther = {
              uid: otherDoc.id,
              email: d.email,
              displayName: d.displayName || 'User',
              photoURL: d.photoURL,
              location: d.location,
              verification: d.verification || { isVerified: false, verificationStatus: 'pending' },
              ratings: d.ratings || { asOwner: { average: 0, count: 0 }, asRenter: { average: 0, count: 0 } },
              wallet: d.wallet || { balance: 0, pendingBalance: 0, totalEarnings: 0 },
              preferences: d.preferences || { notifications: { email: true, push: true, sms: false }, searchRadius: 25, currency: 'USD' },
              stats: d.stats || { itemsListed: 0, itemsRented: 0, successfulRentals: 0 },
              favorites: d.favorites || [],
              createdAt: d.createdAt?.toDate?.() || new Date(),
              updatedAt: d.updatedAt?.toDate?.() || new Date(),
              isActive: d.isActive ?? true,
              fcmTokens: d.fcmTokens || [],
            };
            console.log('Chat: Other user loaded successfully');
          } else {
            console.log('Chat: Other user document not found');
          }
        } catch (userError) {
          console.error('Chat: Error fetching other user:', userError);
          // Create fallback user data
          fetchedOther = {
            uid: otherUserId,
            email: '',
            displayName: 'User',
            location: { latitude: 0, longitude: 0, address: '', city: '', country: '' },
            verification: { isVerified: false, verificationStatus: 'pending' },
            ratings: { asOwner: { average: 0, count: 0 }, asRenter: { average: 0, count: 0 } },
            wallet: { balance: 0, pendingBalance: 0, totalEarnings: 0 },
            preferences: {
              notifications: {
                email: {
                  rentalRequests: true,
                  rentalApprovals: true,
                  rentalRejections: true,
                  messages: true,
                  reviews: true,
                  payments: true,
                  reminders: true,
                  marketing: false,
                },
                push: {
                  rentalRequests: true,
                  rentalApprovals: true,
                  rentalRejections: true,
                  messages: true,
                  reviews: true,
                  payments: true,
                  reminders: true,
                },
                sms: {
                  rentalRequests: false,
                  rentalApprovals: true,
                  rentalRejections: true,
                  payments: true,
                },
              },
              searchRadius: 25,
              currency: 'USD'
            },
            stats: { itemsListed: 0, itemsRented: 0, successfulRentals: 0 },
            favorites: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            fcmTokens: [],
          };
        }
      }
      setOtherUser(fetchedOther);

      // 2. Check if chat exists - DON'T CREATE IT YET
      console.log('Chat: Checking for existing chat...');
      let existingChat: Chat | null = null;

      if (chatId) {
        // If we have a chatId, try to load the existing chat
        try {
          const chatDoc = await getDoc(doc(db, collections.chats, chatId));
          if (chatDoc.exists()) {
            existingChat = mapChatDoc(chatDoc.id, chatDoc.data());
            console.log('Chat: Existing chat found');
          }
        } catch (error) {
          console.error('Chat: Error loading existing chat:', error);
        }
      } else {
        // If no chatId, check if there's an existing chat between these users
        existingChat = await ChatService.findChatByParticipants(
          [user.uid, otherUserId || 'unknown-user'],
          { type: rentalId ? 'rental' : (itemId ? 'general' : 'general'), rentalId, itemId }
        );
      }

      if (existingChat) {
        // Chat exists, set it up normally
        console.log('Chat: Setting up existing chat');

        // Subscribe to messages
        const unsubscribeMessages = ChatService.subscribeToMessages(existingChat.id, (msgs) => {
          setMessages(
            msgs.map(m => ({
              id: m.id,
              senderId: m.senderId,
              type: m.type,
              content: m.content,
              status: m.status,
              timestamp: m.timestamp,
              senderName: m.senderId === user.uid ? (user.displayName || 'You') : (fetchedOther?.displayName || 'User'),
              senderAvatar: (m.senderId === user.uid ? user.photoURL : fetchedOther?.photoURL) || undefined,
            }))
          );
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        });

        // Subscribe to chat updates
        const unsubscribeChat = ChatService.subscribeToChat(existingChat.id, updated => {
          if (updated) setChat(updated);
        });

        // Mark as read if there are messages
        if (existingChat.lastMessage.text) {
          await ChatService.markAsRead(existingChat.id, user.uid);
        }

        setChat(existingChat);

        // Cleanup on unmount
        return () => {
          unsubscribeMessages();
          unsubscribeChat();
        };
      } else {
        // No existing chat - set up placeholder mode
        console.log('Chat: No existing chat found, using placeholder mode');

        const placeholderChat: Chat = {
          id: `placeholder-${Date.now()}`,
          participants: [user.uid, otherUserId || 'unknown-user'],
          participantsKey: [user.uid, otherUserId || 'unknown-user'].sort().join(':'),
          type: rentalId ? 'rental' : 'general',
          rentalId: rentalId || undefined,
          itemId: itemId || undefined,
          lastMessage: {
            text: '',
            senderId: '',
            timestamp: new Date(),
            type: 'text',
          },
          metadata: {
            unreadCount: {},
            isActive: true,
            blockedBy: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setChat(placeholderChat);
        setMessages([]); // Empty messages for new chat
      }

    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || sending || !user || !chat) return;

    try {
      setSending(true);
      const text = messageText.trim();
      setMessageText('');

      // Check if this is a placeholder chat - create real chat first
      if (chat.id.startsWith('placeholder-')) {
        try {
          console.log('Chat: Creating real chat for first message...');
          const realChat = await ChatService.getOrCreateDirectChat(
            user.uid,
            otherUserId || 'unknown-user',
            {
              type: chat.type,
              rentalId: chat.rentalId,
              itemId: chat.itemId
            }
          );

          // Update to real chat
          setChat(realChat);

          // Now send the message to the real chat
          console.log('Chat: Sending first message to real chat...');
          await ChatService.sendMessage({
            chatId: realChat.id,
            senderId: user.uid,
            content: { text },
            type: 'text',
          });

          // Set up real-time subscriptions for the new chat
          const unsubscribeMessages = ChatService.subscribeToMessages(realChat.id, (msgs) => {
            setMessages(
              msgs.map(m => ({
                id: m.id,
                senderId: m.senderId,
                type: m.type,
                content: m.content,
                status: m.status,
                timestamp: m.timestamp,
                senderName: m.senderId === user.uid ? (user.displayName || 'You') : (otherUser?.displayName || 'User'),
                senderAvatar: (m.senderId === user.uid ? user.photoURL : otherUser?.photoURL) || undefined,
              }))
            );
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
          });

          const unsubscribeChat = ChatService.subscribeToChat(realChat.id, updated => {
            if (updated) setChat(updated);
          });

          console.log('Chat: Real chat created and first message sent successfully!');
          return;
        } catch (firebaseError) {
          console.error('Chat: Failed to create real chat:', firebaseError);

          // Fall back to mock mode
          const mockChat = {
            ...chat,
            id: `mock-chat-${Date.now()}`,
          };
          setChat(mockChat);

          Alert.alert(
            'Chat Mode Changed',
            'Switched to testing mode. Your message will be sent in mock mode.',
            [{ text: 'OK' }]
          );
        }
      }

      // Try REAL Firebase message for existing chats
      if (!chat.id.startsWith('mock-chat-')) {
        try {
          console.log('Chat: Sending real Firebase message...');
          await ChatService.sendMessage({
            chatId: chat.id,
            senderId: user.uid,
            content: { text },
            type: 'text',
          });
          console.log('Chat: Real message sent successfully!');
          return;
        } catch (firebaseError) {
          console.error('Chat: Real message failed, switching to mock mode:', firebaseError);

          // Update chat to mock mode
          const mockChat = {
            ...chat,
            id: `mock-chat-${Date.now()}`,
          };
          setChat(mockChat);

          Alert.alert(
            'Chat Mode Changed',
            'Switched to testing mode. Your message will be sent in mock mode.',
            [{ text: 'OK' }]
          );
        }
      }

      // Mock mode: Create local message
      const newMessage: MessageWithUser = {
        id: `msg-${Date.now()}`,
        senderId: user.uid,
        type: 'text',
        content: { text },
        status: { sent: new Date(), delivered: new Date(), read: new Date() },
        timestamp: new Date(),
        senderName: user.displayName || 'You',
        senderAvatar: user.photoURL || undefined,
      };

      // Add to messages list
      setMessages(prev => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

      // Simulate response after a delay (for testing)
      setTimeout(() => {
        const responses = [
          "Thanks for your response!",
          "That sounds good to me.",
          "Can we discuss the details?",
          "Perfect! Let's proceed.",
          "I have a question about...",
          "When can we meet?",
          "What's your availability?",
          "That works for me!",
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        const responseMessage: MessageWithUser = {
          id: `response-${Date.now()}`,
          senderId: otherUser?.uid || 'mock-user',
          type: 'text',
          content: { text: randomResponse },
          status: { sent: new Date(), delivered: new Date() },
          timestamp: new Date(),
          senderName: otherUser?.displayName || 'Other User',
          senderAvatar: undefined,
        };

        setMessages(prev => [...prev, responseMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds

    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: Date | undefined) => {
    if (!timestamp) return '';
    return timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (timestamp: Date) => {
    const today = new Date();
    const messageDate = new Date(timestamp);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderMessage = ({ item: message, index }: { item: MessageWithUser; index: number }) => {
    const isMyMessage = message.senderId === user?.uid;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDateHeader = !prevMessage ||
      formatDate(message.timestamp) !== formatDate(prevMessage.timestamp);

    const showAvatar = !isMyMessage && (
      !messages[index + 1] ||
      messages[index + 1].senderId !== message.senderId ||
      formatDate(message.timestamp) !== formatDate(messages[index + 1].timestamp)
    );

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>
              {formatDate(message.timestamp)}
            </Text>
          </View>
        )}

        <View style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}>
          {!isMyMessage && showAvatar && (
            <Image
              source={{
                uri: message.senderAvatar || 'https://via.placeholder.com/32x32?text=U',
              }}
              style={styles.messageAvatar}
            />
          )}

          {!isMyMessage && !showAvatar && (
            <View style={styles.messageSpacer} />
          )}

          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}>
            <Text style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}>
              {message.content.text}
            </Text>

            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
              ]}>
                {formatTime(message.timestamp)}
              </Text>

              {isMyMessage && (
                <View style={styles.messageStatus}>
                  {(() => {
                    // WhatsApp-style: check if this message was read by the other participant (permanent)
                    const otherUserId = chat?.participants.find(p => p !== user?.uid);
                    const isRead = chat?.metadata?.unreadCount?.[otherUserId || ''] === 0;

                    if (isRead) {
                      return <Ionicons name="checkmark-done-outline" size={16} color="#4639eb" />;
                    } else {
                      return <Ionicons name="checkmark-outline" size={16} color="#6B7280" />;
                    }
                  })()}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Image
              source={{
                uri: otherUser?.photoURL || 'https://via.placeholder.com/40x40?text=U',
              }}
              style={styles.headerAvatar}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerName}>
                {otherUser?.displayName || 'User'}
              </Text>
              <View style={styles.headerSubtitle}>
                {chat?.id.startsWith('mock-chat-') ? (
                  <View style={styles.tempModeBadge}>
                    <Ionicons name="construct" size={12} color="#F59E0B" />
                    <Text style={styles.tempModeText}>Testing Mode</Text>
                  </View>
                ) : (
                  <View style={styles.realModeBadge}>
                    <Ionicons name="chatbubble" size={12} color="#10B981" />
                    <Text style={styles.realModeText}>Live Chat</Text>
                  </View>
                )}
                {otherUser?.verification.isVerified && (
                  <View style={styles.verificationBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.verificationText}>Verified</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call-outline" size={20} color="#4639eb" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Rental Context (if applicable) */}
        {rental && item && (
          <View style={styles.contextCard}>
            <View style={styles.contextHeader}>
              <Ionicons name="calendar-outline" size={16} color="#4639eb" />
              <Text style={styles.contextTitle}>Rental Request</Text>
            </View>
            <Text style={styles.contextItem}>{item.title}</Text>
            <Text style={styles.contextDates}>
              {formatDate(rental.dates.requestedStart)} - {formatDate(rental.dates.requestedEnd)}
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="camera-outline" size={24} color="#6B7280" />
          </TouchableOpacity>

          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === 'Enter') {
                // @ts-ignore - shiftKey exists in native event but not in types
                if (e.nativeEvent.shiftKey) {
                  // Shift+Enter: Allow default behavior (new line)
                  return;
                } else {
                  // Enter: Send message and prevent default
                  e.preventDefault();
                  sendMessage();
                }
              }
            }}
            blurOnSubmit={false}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (messageText.trim().length > 0 && !sending) && styles.sendButtonActive,
            ]}
            onPress={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            <Ionicons
              name={sending ? "hourglass-outline" : "send"}
              size={20}
              color={messageText.trim().length > 0 ? "#FFFFFF" : "#9CA3AF"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
    textAlign: 'left',
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verificationText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  tempModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tempModeText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '500',
  },
  realModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  realModeText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
  },
  callButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageSpacer: {
    width: 40,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: '#4639eb',
    borderBottomRightRadius: 8,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
    textAlign: 'left',
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#111827',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#9CA3AF',
  },
  messageStatus: {
    marginLeft: 4,
  },
  doubleCheckContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkOne: {
    marginRight: -6,
  },
  checkTwo: {
    marginLeft: -6,
  },
  contextCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4639eb',
  },
  contextItem: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  contextDates: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  attachButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  messageInput: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    fontSize: 16,
    color: '#111827',
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#4639eb',
  },
});

export default ChatScreen;
