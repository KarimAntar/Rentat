import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../contexts/AuthContext';
import { diditKycService } from '../services/diditKyc';

interface UserGreetingProps {
  showGreeting?: boolean;
  customGreeting?: string;
  avatarSize?: number;
}

const UserGreeting: React.FC<UserGreetingProps> = ({
  showGreeting = true,
  customGreeting,
  avatarSize = 48,
}) => {
  const { user } = useAuthContext();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    checkVerificationStatus();
  }, [user]);

  const checkVerificationStatus = async () => {
    if (!user) return;

    try {
      const verified = await diditKycService.isUserKycVerified(user.uid);
      setIsVerified(verified);
    } catch (error) {
      console.error('Error checking verification status:', error);
      setIsVerified(false);
    }
  };

  const getGreeting = () => {
    if (customGreeting) return customGreeting;

    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getDisplayName = () => {
    if (user?.displayName) {
      // Return only the first name (before the first space)
      return user.displayName.split(' ')[0];
    }
    return 'Visitor';
  };

  return (
    <View style={styles.greetingWithAvatar}>
      <View style={styles.avatarContainer}>
        {user?.photoURL ? (
          <Image
            source={{ uri: user.photoURL }}
            style={[
              styles.userAvatar,
              { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
              isVerified && styles.verifiedAvatar
            ]}
          />
        ) : (
          <View
            style={[
              styles.userAvatar,
              { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
              isVerified && styles.verifiedAvatar
            ]}
          >
            <Ionicons name="person" size={avatarSize * 0.4} color="#6B7280" />
          </View>
        )}
                {isVerified && (
                  <View style={[styles.verificationBadge, { bottom: -avatarSize * 0.05, right: -avatarSize * 0.05 }]}>
                    <Ionicons name="checkmark-circle" size={avatarSize * 0.3} color="#0EA5E9" />
                  </View>
                )}
      </View>
      {showGreeting && (
        <View style={styles.greetingTextContainer}>
          <Text style={styles.greetingText}>
            {getGreeting()}
          </Text>
          <Text style={styles.greetingName}>
            {getDisplayName()} 👋
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  greetingWithAvatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  userAvatar: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedAvatar: {
    borderWidth: 2,
    borderColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  verificationBadge: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'left',
  },
  greetingName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4639eb',
    marginTop: 4,
    textAlign: 'left',
  },
});

export default UserGreeting;
