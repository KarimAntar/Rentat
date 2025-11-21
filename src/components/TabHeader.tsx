import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthContext } from '../contexts/AuthContext';
import { db, collections } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import UserGreeting from './UserGreeting';

interface TabHeaderProps {
  showGreeting?: boolean;
  title?: string;
  showBackButton?: boolean;
  showNotifications?: boolean;
  showMessages?: boolean;
  showSignOut?: boolean;
  onSignOut?: () => void;
}

// Global unread message count hook to prevent multiple listeners
const useUnreadMessageCount = () => {
  const { user } = useAuthContext();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const q = query(
      collection(db, collections.chats),
      where('participants', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      let totalUnread = 0;
      snap.forEach((doc) => {
        const data = doc.data();
        const unreadCount = data.metadata?.unreadCount?.[user.uid] || 0;
        totalUnread += unreadCount;
      });
      setCount(totalUnread);
    }, (err) => {
      console.error('UnreadMessageCount listener error:', err);
    });

    return () => unsub();
  }, [user]);

  return count;
};

const UnreadMessageBadge: React.FC = () => {
  const count = useUnreadMessageCount();

  if (!count) return null;

  return (
    <View
      style={{
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
};

const UnreadNotificationBadge: React.FC = () => {
  const { user } = useAuthContext();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const q = query(
      collection(db, collections.notifications),
      where('userId', '==', user.uid),
      where('status', '==', 'unread')
    );

    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.size);
    }, (err) => {
      console.error('UnreadNotificationBadge listener error:', err);
    });

    return () => unsub();
  }, [user]);

  if (!count) return null;

  return (
    <View
      style={{
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
};

const TabHeader: React.FC<TabHeaderProps> = ({
  showGreeting = true,
  title,
  showBackButton = false,
  showNotifications = true,
  showMessages = true,
  showSignOut = false,
  onSignOut,
}) => {
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <View style={styles.greetingSection}>
        {showBackButton ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        ) : showGreeting ? (
          <UserGreeting avatarSize={56} />
        ) : (
          title && <Text style={styles.title}>{title}</Text>
        )}
      </View>
      <View style={styles.headerActions}>
        {showMessages && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('Messages')}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#6B7280" />
            <View style={{ position: 'absolute', top: -6, right: -6 }}>
              <UnreadMessageBadge />
            </View>
          </TouchableOpacity>
        )}
        {showNotifications && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color="#6B7280" />
            <View style={{ position: 'absolute', top: -6, right: -6 }}>
              <UnreadNotificationBadge />
            </View>
          </TouchableOpacity>
        )}
        {showSignOut && onSignOut && (
          <TouchableOpacity onPress={onSignOut} style={styles.actionButton}>
            <Ionicons name="log-out-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  greetingSection: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TabHeader;
export { useUnreadMessageCount };
