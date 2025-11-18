import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Chat, Message, User, Item, Rental } from '../../types';
import ChatService, { mapChatDoc } from '../../services/chat';
import { db, collections } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { moderationService, ReportReason } from '../../services/moderation';
import ReportModal from '../../components/ui/ReportModal';
import Toast from 'react-native-toast-message';

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
  const { showModal } = useModal();

  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [messageText, setMessageText] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageUnsubscribe, setMessageUnsubscribe] = useState<(() => void) | null>(null);

  // Modal states
  const [reportUserModalVisible, setReportUserModalVisible] = useState(false);
  const [reportMessageModalVisible, setReportMessageModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageWithUser | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  // Cleanup subscription when component unmounts or chat changes
  useEffect(() => {
    return () => {
      if (messageUnsubscribe) {
        messageUnsubscribe();
      }
    };
  }, [messageUnsubscribe]);

  // State to track if we should scroll to bottom
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  // Auto-scroll to bottom when messages are loaded or updated
  useLayoutEffect(() => {
    if (messages.length > 0 && !loading && shouldScrollToBottom) {
      const scrollToBottom = () => {
        if (Platform.OS === 'web') {
          // For web, use a more reliable approach
          setTimeout(() => {
            const scrollView = scrollViewRef.current as any;
            if (scrollView && scrollView.scrollToEnd) {
              scrollView.scrollToEnd({ animated: false });
            } else {
              // Fallback: find scrollable containers
              const scrollContainers = document.querySelectorAll('[style*="overflow"]');
              scrollContainers.forEach(container => {
                const element = container as HTMLElement;
                if (element.scrollHeight > element.clientHeight) {
                  element.scrollTop = element.scrollHeight;
                }
              });
            }
          }, 100);
        } else {
          // For native, use scrollToEnd
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }, 100);
        }
      };

      scrollToBottom();
      setShouldScrollToBottom(false);
    }
  }, [messages.length, loading, shouldScrollToBottom]);

  const initializeChat = async () => {
    try {
      if (!user) return;
      setLoading(true);

      // Fetch other user
      if (otherUserId) {
        try {
          const otherDoc = await getDoc(doc(db, collections.users, otherUserId));
          if (otherDoc.exists()) {
            const d = otherDoc.data();
            setOtherUser({
              uid: otherDoc.id,
              email: d.email,
              displayName: d.displayName || 'User',
              photoURL: d.photoURL,
              location: d.location,
              verification: d.verification || { isVerified: false, verificationStatus: 'pending' },
              ratings: d.ratings || { asOwner: { average: 0, count: 0 }, asRenter: { average: 0, count: 0 } },
              wallet: d.wallet || { balance: 0, pendingBalance: 0, totalEarnings: 0 },
              preferences: d.preferences,
              stats: d.stats || { itemsListed: 0, itemsRented: 0, successfulRentals: 0 },
              favorites: d.favorites || [],
              createdAt: d.createdAt?.toDate?.() || new Date(),
              updatedAt: d.updatedAt?.toDate?.() || new Date(),
              isActive: d.isActive ?? true,
              fcmTokens: d.fcmTokens || [],
            });
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }

      // Check for existing chat
      let existingChat: Chat | null = null;
      if (chatId) {
        const chatDoc = await getDoc(doc(db, collections.chats, chatId));
        if (chatDoc.exists()) {
          existingChat = mapChatDoc(chatDoc.id, chatDoc.data());
        }
      } else {
        existingChat = await ChatService.findChatByParticipantsKey(
          [user.uid, otherUserId || 'unknown'].sort().join(':'),
          { type: rentalId ? 'rental' : 'general', rentalId, itemId }
        );
      }

      if (existingChat) {
        // Check if current user is a participant
        if (!existingChat.participants.includes(user.uid)) {
          showModal({
            title: 'Error',
            message: 'You do not have permission to access this chat.',
            type: 'error',
          });
          setLoading(false);
          return;
        }
        setChat(existingChat);
        // Subscribe to messages only for real chat documents
        const unsubscribe = ChatService.subscribeToMessages(existingChat.id, (msgs) => {
          // Mark messages from other users as read locally when chat is opened
          const updatedMsgs = msgs.map(m => {
            if (m.senderId !== user.uid && !m.status?.read) {
              return {
                ...m,
                status: {
                  ...m.status,
                  read: new Date(),
                }
              };
            }
            return m;
          });
          setMessages(
            updatedMsgs.map(m => ({
              ...m,
              senderName: m.senderId === user.uid ? (user.displayName || 'You') : 'User',
              senderAvatar: (m.senderId === user.uid ? user.photoURL : undefined) || undefined,
            }))
          );
          // Trigger scroll to bottom when messages are loaded
          setShouldScrollToBottom(true);
        });
        setMessageUnsubscribe(() => unsubscribe);
        await ChatService.markAsRead(existingChat.id, user.uid);
      } else {
        // Create placeholder chat for UI display only - no Firestore subscription
        setChat({
          id: `placeholder-${Date.now()}`,
          participants: [user.uid, otherUserId || 'unknown'],
          participantsKey: [user.uid, otherUserId || 'unknown'].sort().join(':'),
          type: rentalId ? 'rental' : 'general',
          rentalId,
          itemId,
          lastMessage: { text: '', senderId: '', timestamp: new Date(), type: 'text' },
          metadata: { unreadCount: {}, isActive: true, blockedBy: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        // No subscription for placeholder chats
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      showModal({
        title: 'Error',
        message: 'Failed to load chat',
        type: 'error',
      });
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

      if (chat.id.startsWith('placeholder-')) {
        const realChat = await ChatService.getOrCreateDirectChat(
          user.uid,
          otherUserId || 'unknown',
          { type: chat.type, rentalId: chat.rentalId, itemId: chat.itemId }
        );
        setChat(realChat);

        // Subscribe to messages for the real chat
        const unsubscribe = ChatService.subscribeToMessages(realChat.id, (msgs) => {
          // Mark messages from other users as read locally when chat is opened
          const updatedMsgs = msgs.map(m => {
            if (m.senderId !== user.uid && !m.status?.read) {
              return {
                ...m,
                status: {
                  ...m.status,
                  read: new Date(),
                }
              };
            }
            return m;
          });
          setMessages(
            updatedMsgs.map(m => ({
              ...m,
              senderName: m.senderId === user.uid ? (user.displayName || 'You') : 'User',
              senderAvatar: (m.senderId === user.uid ? user.photoURL : undefined) || undefined,
            }))
          );
          // Trigger scroll to bottom when messages are loaded
          setShouldScrollToBottom(true);
        });

        await ChatService.sendMessage({
          chatId: realChat.id,
          senderId: user.uid,
          content: { text },
          type: 'text',
        });

        await ChatService.markAsRead(realChat.id, user.uid);
        setMessageUnsubscribe(() => unsubscribe);
      } else {
        await ChatService.sendMessage({
          chatId: chat.id,
          senderId: user.uid,
          content: { text },
          type: 'text',
        });
        // Scroll to bottom when sending a message
        setShouldScrollToBottom(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showModal({
        title: 'Error',
        message: 'Failed to send message',
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: Date | undefined) => {
    if (!timestamp) return '';
    return timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleReportUser = () => {
    if (!user || !otherUser) {
      showModal({
        title: 'Error',
        message: 'Unable to report user',
        type: 'error',
      });
      return;
    }

    setReportUserModalVisible(true);
  };

  const handleReportUserSubmit = async (reason: ReportReason, description: string) => {
    if (!user || !otherUser) return;

    try {
      await moderationService.reportUser(
        otherUser.uid,
        user.uid,
        reason,
        description
      );

      Toast.show({
        type: 'success',
        text1: 'Report Submitted',
        text2: 'Thank you for helping keep Rentat safe',
        position: 'top',
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      showModal({
        title: 'Error',
        message: 'Failed to submit report. Please try again.',
        type: 'error',
      });
    }
  };

  const handleReportMessage = (message: MessageWithUser) => {
    if (!user || message.senderId === user.uid) {
      return;
    }

    setSelectedMessage(message);
    setReportMessageModalVisible(true);
  };

  const handleReportMessageSubmit = async (reason: ReportReason, description: string) => {
    if (!user || !chat || !otherUser || !selectedMessage) return;

    try {
      await moderationService.reportChat(
        chat.id,
        selectedMessage.id,
        user.uid,
        otherUser.uid,
        reason,
        `Message: "${selectedMessage.content.text}"\n\nReason: ${description}`
      );

      Toast.show({
        type: 'success',
        text1: 'Report Submitted',
        text2: 'Thank you for helping keep Rentat safe',
        position: 'top',
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      showModal({
        title: 'Error',
        message: 'Failed to submit report. Please try again.',
        type: 'error',
      });
    }
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
      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Image
          source={{ uri: otherUser?.photoURL || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerName}>{otherUser?.displayName || 'User'}</Text>
          {otherUser?.verification.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.callButton}>
          <Ionicons name="call-outline" size={20} color="#4639eb" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.reportButton} onPress={handleReportUser}>
          <Ionicons name="flag-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Scrollable Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (Platform.OS === 'web') {
            setTimeout(() => {
              const scrollView = scrollViewRef.current as any;
              if (scrollView && scrollView.scrollToEnd) {
                scrollView.scrollToEnd({ animated: false });
              } else {
                const scrollContainers = document.querySelectorAll('[style*="overflow"]');
                scrollContainers.forEach(container => {
                  const element = container as HTMLElement;
                  if (element.scrollHeight > element.clientHeight) {
                    element.scrollTop = element.scrollHeight;
                  }
                });
              }
            }, 100);
          } else {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }, 100);
          }
        }}
      >
      {messages.map((msg, index) => {
        const isMyMessage = msg.senderId === user?.uid;
        const getMessageStatus = () => {
          if (!isMyMessage) return null;
          if (msg.status?.read) return { icon: 'checkmark-done', color: '#4639eb', label: 'read' };
          if (msg.status?.delivered) return { icon: 'checkmark-done', color: '#6B7280', label: 'delivered' };
          if (msg.status?.sent) return { icon: 'checkmark', color: '#6B7280', label: 'sent' };
          // For older messages without status, assume sent
          return { icon: 'checkmark', color: '#6B7280', label: 'sent' };
        };

        const status = getMessageStatus();

        return (
          <TouchableOpacity
            key={msg.id}
            style={[styles.messageRow, isMyMessage ? styles.myMessageRow : styles.otherMessageRow]}
            onLongPress={() => !isMyMessage && handleReportMessage(msg)}
            activeOpacity={isMyMessage ? 1 : 0.7}
          >
            <View style={[styles.messageBubble, isMyMessage ? styles.myBubble : styles.otherBubble]}>
              <Text style={[styles.messageText, isMyMessage ? styles.myText : styles.otherText]}>
                {msg.content.text}
              </Text>
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, isMyMessage ? styles.myTime : styles.otherTime]}>
                  {formatTime(msg.timestamp)}
                </Text>
                {status && (
                  <View style={styles.statusContainer}>
                    <Ionicons
                      name={status.icon as any}
                      size={14}
                      color={status.color}
                      style={styles.statusIcon}
                    />
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      </ScrollView>

      {/* Fixed Bottom Input */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="camera-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, messageText.trim() ? styles.sendButtonActive : null]}
          onPress={sendMessage}
          disabled={!messageText.trim() || sending}
        >
          <Ionicons name="send" size={20} color={messageText.trim() ? '#FFFFFF' : '#9CA3AF'} />
        </TouchableOpacity>
      </View>

      {/* Report Modals */}
      <ReportModal
        visible={reportUserModalVisible}
        title="Report User"
        message="Why are you reporting this user?"
        reasons={[
          { label: 'Harassment', value: 'harassment' },
          { label: 'Inappropriate Content', value: 'inappropriate_content' },
          { label: 'Scam/Fraud', value: 'scam' },
          { label: 'Spam', value: 'spam' },
          { label: 'Other', value: 'other' },
        ]}
        onSubmit={handleReportUserSubmit}
        onCancel={() => setReportUserModalVisible(false)}
        type="user"
      />

      <ReportModal
        visible={reportMessageModalVisible}
        title="Report Message"
        message="Why are you reporting this message?"
        reasons={[
          { label: 'Harassment', value: 'harassment' },
          { label: 'Inappropriate Content', value: 'inappropriate_content' },
          { label: 'Scam/Fraud', value: 'scam' },
          { label: 'Spam', value: 'spam' },
          { label: 'Other', value: 'other' },
        ]}
        onSubmit={handleReportMessageSubmit}
        onCancel={() => setReportMessageModalVisible(false)}
        type="message"
      />
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
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : { position: 'absolute' }),
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  callButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
  },
  reportButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
  },
  messagesScroll: {
    flex: 1,
    marginTop: 60,
    marginBottom: 80,
  },
  messagesContent: {
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#4639eb',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
  },
  myTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherTime: {
    color: '#9CA3AF',
  },
  inputBar: {
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : { position: 'absolute' }),
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
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
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    fontSize: 16,
    color: '#111827',
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
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusContainer: {
    marginLeft: 8,
  },
  statusIcon: {
    marginLeft: 2,
  },
});

export default ChatScreen;
