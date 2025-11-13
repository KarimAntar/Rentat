import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types';
import { useAuthContext } from '../../contexts/AuthContext';
import { Chat, User, Item } from '../../types';
import ChatService from '../../services/chat';
import { db, collections } from '../../config/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface ChatWithDetails extends Chat {
  otherUser?: User;
  item?: Item;
  displayName: string;
  unreadCount: number;
}

const MessagesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Subscribe to user's chats and listen for real-time updates
    const chatsQuery = query(
      collection(db, collections.chats),
      where('participants', 'array-contains', user.uid)
    );

    // Listen for changes in all chats in real time, including unreadCount
    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      try {
        const chatsData: ChatWithDetails[] = [];

        for (const doc of snapshot.docs) {
          const chatData = doc.data();
          const chat: Chat = {
            id: doc.id,
            participants: chatData.participants || [],
            participantsKey: chatData.participantsKey || '',
            type: chatData.type || 'general',
            rentalId: chatData.rentalId,
            itemId: chatData.itemId,
            lastMessage: {
              text: chatData.lastMessage?.text || '',
              senderId: chatData.lastMessage?.senderId || '',
              timestamp: chatData.lastMessage?.timestamp?.toDate?.() || new Date(chatData.lastMessage?.timestamp || Date.now()),
              type: chatData.lastMessage?.type || 'text',
            },
            metadata: chatData.metadata || { unreadCount: {}, isActive: true },
            createdAt: chatData.createdAt?.toDate?.() || new Date(chatData.createdAt || Date.now()),
            updatedAt: chatData.updatedAt?.toDate?.() || new Date(chatData.updatedAt || Date.now()),
          };

          // Find the other participant
          const otherUserId = chat.participants.find(p => p !== user.uid);
          let otherUser: User | undefined;
          let item: Item | undefined;

          if (otherUserId) {
            // Fetch other user data
            try {
              const userDoc = await fetchUserData(otherUserId);
              otherUser = userDoc;
            } catch (error) {
              console.error('Error fetching user data:', error);
            }
          }

          if (chat.itemId) {
            // Fetch item data
            try {
              const itemDoc = await fetchItemData(chat.itemId);
              item = itemDoc;
            } catch (error) {
              console.error('Error fetching item data:', error);
            }
          }

          // Create display name: "[User First Name] + [Item Title]"
          const userFirstName = otherUser?.displayName?.split(' ')[0] || 'User';
          const itemTitle = item?.title || 'Item';
          const displayName = `${userFirstName} - ${itemTitle}`;

          // Get unread count for current user (count only messages not sent by user)
          // Fix: unreadCount should be the number of messages sent by others and not read by user
          let unreadCount = 0;
          if (chat.metadata?.unreadCount && typeof chat.metadata.unreadCount[user.uid] === 'number') {
            unreadCount = chat.metadata.unreadCount[user.uid];
          }
          unreadCount = Math.max(0, unreadCount);

          chatsData.push({
            ...chat,
            otherUser,
            item,
            displayName,
            unreadCount,
          });
        }

        // Sort chats by last message timestamp descending
        chatsData.sort((a, b) => {
          const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
          const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
          return bTime - aTime;
        });

        setChats(chatsData);
        setLoading(false);
      } catch (error) {
        console.error('Error processing chats:', error);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [user]);

  const fetchUserData = async (userId: string): Promise<User | undefined> => {
    try {
      const userDocRef = doc(db, collections.users, userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid: userDoc.id,
          email: data.email || '',
          displayName: data.displayName || 'User',
          photoURL: data.photoURL,
          location: data.location || {
            latitude: 0,
            longitude: 0,
            address: '',
            city: '',
            country: '',
          },
          verification: data.verification || { isVerified: false, verificationStatus: 'pending' },
          ratings: data.ratings || { asOwner: { average: 0, count: 0 }, asRenter: { average: 0, count: 0 } },
          wallet: data.wallet || { balance: 0, pendingBalance: 0, totalEarnings: 0 },
          preferences: data.preferences || {
            notifications: {
              email: { rentalRequests: true, rentalApprovals: true, rentalRejections: true, messages: true, reviews: true, payments: true, reminders: true, marketing: false },
              push: { rentalRequests: true, rentalApprovals: true, rentalRejections: true, messages: true, reviews: true, payments: true, reminders: true },
              sms: { rentalRequests: false, rentalApprovals: true, rentalRejections: true, payments: true },
            },
            searchRadius: 25,
            currency: 'USD'
          },
          stats: data.stats || { itemsListed: 0, itemsRented: 0, successfulRentals: 0 },
          favorites: data.favorites || [],
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          isActive: data.isActive ?? true,
          fcmTokens: data.fcmTokens || [],
        };
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    return undefined;
  };

  const fetchItemData = async (itemId: string): Promise<Item | undefined> => {
    try {
      const itemDocRef = doc(db, collections.items, itemId);
      const itemDoc = await getDoc(itemDocRef);

      if (itemDoc.exists()) {
        const data = itemDoc.data();
        return {
          id: itemDoc.id,
          ownerId: data.ownerId || '',
          title: data.title || '',
          description: data.description || '',
          category: data.category || '',
          subcategory: data.subcategory,
          brand: data.brand,
          model: data.model,
          condition: data.condition || 'good',
          governorate: data.governorate || '',
          images: data.images || [],
          pricing: data.pricing || { dailyRate: 0, currency: 'USD', securityDeposit: 0 },
          availability: data.availability || { isAvailable: true, calendar: {}, minRentalDays: 1, maxRentalDays: 30, advanceBookingDays: 1 },
          location: data.location || { latitude: 0, longitude: 0, address: '', city: '', country: '' },
          specifications: data.specifications || {},
          policies: data.policies || { cancellationPolicy: 'flexible' },
          ratings: data.ratings || { average: 0, count: 0 },
          stats: data.stats || { views: 0, favorites: 0, totalRentals: 0, revenue: 0 },
          status: data.status || 'active',
          boost: data.boost,
          featured: data.featured || { isFeatured: false, boostLevel: 0 },
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          tags: data.tags || [],
        };
      }
    } catch (error) {
      console.error('Error fetching item:', error);
    }
    return undefined;
  };

  const handleChatPress = (chat: ChatWithDetails) => {
    // Double check: only mark as read if there are actually unread messages
    if (chat.unreadCount > 0) {
      ChatService.markAsRead(chat.id, user!.uid);
    }

    // Navigate to chat
    const otherUserId = chat.participants.find(p => p !== user!.uid);
    const params: any = {
      chatId: chat.id,
    };

    if (chat.itemId) params.itemId = chat.itemId;
    if (otherUserId) params.otherUserId = otherUserId;

    (navigation as any).navigate('Chat', params);
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return timestamp.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderChatItem = ({ item: chat }: { item: ChatWithDetails }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => handleChatPress(chat)}
    >
      <View style={styles.chatAvatar}>
        <Image
          source={{
            uri: chat.item?.images?.[0] || chat.otherUser?.photoURL || 'https://via.placeholder.com/50x50?text=C',
          }}
          style={styles.avatarImage}
        />
        {chat.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {chat.displayName}
          </Text>
          <Text style={styles.chatTime}>
            {formatTime(chat.lastMessage.timestamp)}
          </Text>
        </View>

        <View style={styles.chatMessage}>
          <View style={styles.messageContent}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {chat.lastMessage.text || 'No messages yet'}
            </Text>
            {chat.lastMessage.senderId === user?.uid && (
              <View style={styles.messageStatus}>
                {(() => {
                  // Check if this message was read by the other participant
                  const otherUserId = chat.participants.find(p => p !== user.uid);
                  // WhatsApp-style: check if last message was read by recipient (permanent)
                  const lastMsgRead = chat.lastMessage.senderId === user.uid &&
                    chat.lastMessage.text &&
                    chat.metadata?.unreadCount?.[otherUserId || ''] === 0;

                  if (lastMsgRead) {
                    return <Ionicons name="checkmark-done-outline" size={14} color="#4639eb" />;
                  } else {
                    return <Ionicons name="checkmark-outline" size={14} color="#6B7280" />;
                  }
                })()}
              </View>
            )}
          </View>
          {chat.unreadCount > 0 && (
            <View style={styles.unreadIndicator} />
          )}
        </View>

        {chat.item && (
          <View style={styles.itemInfo}>
            <Ionicons name="pricetag-outline" size={12} color="#6B7280" />
            <Text style={styles.itemTitle} numberOfLines={1}>
              {chat.item.title}
            </Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleStartNewChat = () => {
    // Navigate to search screen to find items to chat about
    (navigation as any).navigate('Search');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.searchButton} onPress={handleStartNewChat}>
            <Ionicons name="add-circle-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyText}>
            Start chatting with people about items you're interested in renting.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          style={styles.chatsList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'left',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  searchButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  chatsList: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  chatAvatar: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
    textAlign: 'left',
  },
  chatTime: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'left',
  },
  chatMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    textAlign: 'left',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4639eb',
    marginLeft: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemTitle: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  messageStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageStatus: {
    marginLeft: 4,
  },
  doubleCheckContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkOne: {
    marginRight: -4,
  },
  checkTwo: {
    marginLeft: -4,
  },
});

export default MessagesScreen;
