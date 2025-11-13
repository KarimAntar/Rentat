import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { useAuthContext } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

type NavigationProp = StackNavigationProp<RootStackParamList>;
import Button from '../../components/ui/Button';
import { SubscriptionModal } from '../../components/ui/SubscriptionModal';
import { commissionService } from '../../services/commission';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, collections } from '../../config/firebase';
import { UserSubscription } from '../../services/subscriptions';
import { diditKycService } from '../../services/diditKyc';
import { useUserBalance, useUserTransactions } from '../../hooks/useFirestore';

interface TierInfo {
  currentTier: string;
  completedRentals: number;
  nextTier?: {
    name: string;
    rentalsNeeded: number;
    currentRate: number;
    nextRate: number;
  };
}

const ProfileScreen: React.FC = () => {
  const { user, signOut } = useAuthContext();
  const navigation = useNavigation<NavigationProp>();
  const { showModal } = useModal();
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [kycVerified, setKycVerified] = useState(false);
  const [kycLoading, setKycLoading] = useState(true);

  const { balance, loading: balanceLoading, error: balanceError } = useUserBalance(user?.uid || null);
  const { data: transactions, loading: transactionsLoading } = useUserTransactions(user?.uid || null);

  useEffect(() => {
    loadTierInfo();
    checkVerificationStatus();
  }, [user]);

  // Refresh data when screen gains focus (e.g., returning from KYC screen)
  useFocusEffect(
    React.useCallback(() => {
      checkVerificationStatus();
      loadTierInfo();
    }, [user])
  );

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

  const handleEditProfile = () => {
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      (parentNavigation as any).navigate('EditProfile');
    }
  };

  const loadTierInfo = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const config = commissionService.getConfig();
      
      // Get completed rentals count
      const rentalsQuery = query(
        collection(db, collections.rentals),
        where('ownerId', '==', user.uid),
        where('status', '==', 'completed')
      );
      const snapshot = await getDocs(rentalsQuery);
      const completedRentals = snapshot.size;

      // Determine current tier
      const sortedTiers = [...config.tierRates].sort((a, b) => b.minRentals - a.minRentals);
      let currentTier = sortedTiers[sortedTiers.length - 1];
      
      for (const tier of sortedTiers) {
        if (completedRentals >= tier.minRentals) {
          currentTier = tier;
          break;
        }
      }

      // Calculate next tier info
      const currentTierIndex = config.tierRates.findIndex(t => t.tier === currentTier.tier);
      let nextTierData;
      
      if (currentTierIndex < config.tierRates.length - 1) {
        const nextTier = config.tierRates[currentTierIndex + 1];
        nextTierData = {
          name: nextTier.tier,
          rentalsNeeded: nextTier.minRentals - completedRentals,
          currentRate: currentTier.commissionRate * 100,
          nextRate: nextTier.commissionRate * 100,
        };
      }

      setTierInfo({
        currentTier: currentTier.tier,
        completedRentals,
        nextTier: nextTierData,
      });
    } catch (error) {
      console.error('Error loading tier info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Navigate to Auth stack after sign out (allows back navigation)
      navigation.navigate('Auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Bronze': return '#CD7F32';
      case 'Silver': return '#C0C0C0';
      case 'Gold': return '#FFD700';
      case 'Platinum': return '#E5E4E2';
      default: return '#6B7280';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Bronze': return 'medal-outline';
      case 'Silver': return 'medal-outline';
      case 'Gold': return 'medal';
      case 'Platinum': return 'trophy';
      default: return 'medal-outline';
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;

    try {
      // Check if user is KYC verified
      await diditKycService.requireKycVerification(user.uid);

      // Proceed with withdrawal
      console.log('Proceed with withdrawal');
      // TODO: Implement actual withdrawal flow
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      if (errorMessage === 'KYC_REQUIRED') {
        showModal({
          title: 'Verification Required',
          message: 'You need to complete identity verification before you can withdraw funds. This helps keep our community safe and secure.',
          type: 'warning',
          buttons: [
            { text: 'Cancel', onPress: () => {}, style: 'cancel' },
            {
              text: 'Verify Now',
              onPress: () => {
                const parentNavigation = navigation.getParent();
                if (parentNavigation) {
                  parentNavigation.navigate('KYCVerification');
                }
              },
              style: 'default'
            }
          ]
        });
      } else if (errorMessage === 'KYC_IN_PROGRESS') {
        showModal({
          title: 'Verification In Progress',
          message: 'Your identity verification is currently in progress. Please wait for it to be completed before withdrawing funds.',
          type: 'info'
        });
      } else if (errorMessage === 'KYC_IN_REVIEW') {
        showModal({
          title: 'Verification Under Review',
          message: 'Your identity verification is under review. We will notify you once it has been completed.',
          type: 'info'
        });
      } else if (errorMessage === 'KYC_REJECTED') {
        showModal({
          title: 'Verification Rejected',
          message: 'Your identity verification was rejected. Please contact support for more information.',
          type: 'error'
        });
      } else if (errorMessage === 'KYC_EXPIRED') {
        showModal({
          title: 'Verification Expired',
          message: 'Your identity verification has expired. Please complete the verification process again.',
          type: 'warning',
          buttons: [
            { text: 'Cancel', onPress: () => {}, style: 'cancel' },
            {
              text: 'Verify Again',
              onPress: () => {
                const parentNavigation = navigation.getParent();
                if (parentNavigation) {
                  parentNavigation.navigate('KYCVerification');
                }
              },
              style: 'default'
            }
          ]
        });
      } else {
        showModal({
          title: 'Error',
          message: 'Failed to process withdrawal. Please try again.',
          type: 'error'
        });
      }
    }
  };

  // Get display name (first name only) or fallback
  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'User';
  const email = user?.email || 'No email';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#6B7280" />
            </View>
          )}
          <View style={styles.nameRow}>
            <Text style={styles.name}>Welcome, {displayName}!</Text>
            {isVerified && (
              <View style={styles.kycVerifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.kycVerifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.email}>{email}</Text>
          {user && !user.emailVerified && (
            <View style={styles.verificationBadge}>
              <Ionicons name="alert-circle" size={16} color="#F59E0B" />
              <Text style={styles.verificationText}>Email not verified</Text>
            </View>
          )}
        </View>

        {/* Identity Verification Prompt - Only show if not verified */}
        {isVerified === false && (
          <View style={styles.verificationPrompt}>
            <View style={styles.verificationPromptContent}>
              <Ionicons name="shield-checkmark" size={48} color="#4639eb" />
              <Text style={styles.verificationPromptTitle}>
                Complete Identity Verification
              </Text>
              <Text style={styles.verificationPromptMessage}>
                Verify your identity to unlock withdrawals, rental requests, and all premium features.
              </Text>
              <Button
                title="Verify Identity"
                onPress={() => {
                  const parentNavigation = navigation.getParent();
                  if (parentNavigation) {
                    parentNavigation.navigate('KYCVerification');
                  }
                }}
                style={styles.verificationButton}
              />
            </View>
          </View>
        )}

        {/* Wallet Balance Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <Ionicons name="wallet" size={24} color="#4639eb" />
            <Text style={styles.walletTitle}>Wallet Balance</Text>
          </View>
          {balanceLoading ? (
            <ActivityIndicator size="large" color="#4639eb" style={styles.walletLoader} />
          ) : (
            <Text style={styles.walletAmount}>
              EGP {balance.toFixed(2)}
            </Text>
          )}
          {balanceError && (
            <Text style={styles.errorText}>{balanceError}</Text>
          )}
          <View style={styles.walletActions}>
            <Button
              title={kycVerified ? "Withdraw" : "Verify to Withdraw"}
              onPress={handleWithdraw}
              style={styles.withdrawButton}
              size="small"
              disabled={balance <= 0 || kycLoading}
            />
          </View>
          {!kycVerified && !kycLoading && (
            <Text style={styles.kycWarning}>
              Complete identity verification to unlock withdrawals
            </Text>
          )}
        </View>

        {/* Commission Tier Card */}
        {loading ? (
          <View style={styles.tierCard}>
            <ActivityIndicator size="large" color="#4639eb" />
          </View>
        ) : tierInfo && (
          <View style={styles.tierCard}>
            <View style={styles.tierHeader}>
              <Ionicons
                name={getTierIcon(tierInfo.currentTier) as any}
                size={32}
                color={getTierColor(tierInfo.currentTier)}
              />
              <View style={styles.tierHeaderText}>
                <Text style={styles.tierTitle}>Commission Tier</Text>
                <Text style={[styles.tierName, { color: getTierColor(tierInfo.currentTier) }]}>
                  {tierInfo.currentTier}
                </Text>
              </View>
            </View>

            <View style={styles.tierStats}>
              <View style={styles.tierStat}>
                <Text style={styles.tierStatNumber}>{tierInfo.completedRentals}</Text>
                <Text style={styles.tierStatLabel}>Completed Rentals</Text>
              </View>
              <View style={styles.tierDivider} />
              <View style={styles.tierStat}>
                <Text style={styles.tierStatNumber}>
                  {tierInfo.nextTier ? `${tierInfo.nextTier.currentRate}%` : '5%'}
                </Text>
                <Text style={styles.tierStatLabel}>Commission Rate</Text>
              </View>
            </View>

            {tierInfo.nextTier && (
              <View style={styles.nextTierInfo}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>
                    Progress to {tierInfo.nextTier.name}
                  </Text>
                  <Text style={styles.progressValue}>
                    {tierInfo.nextTier.rentalsNeeded} more rentals
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          (tierInfo.completedRentals / (tierInfo.completedRentals + tierInfo.nextTier.rentalsNeeded)) * 100,
                          100
                        )}%`
                      }
                    ]}
                  />
                </View>
                <Text style={styles.nextTierBenefit}>
                  Unlock {tierInfo.nextTier.nextRate}% commission rate
                  (save {(tierInfo.nextTier.currentRate - tierInfo.nextTier.nextRate).toFixed(1)}% per rental!)
                </Text>
              </View>
            )}

            {!tierInfo.nextTier && (
              <View style={styles.maxTierBadge}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.maxTierText}>
                  You've reached the highest tier! 🎉
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Items Listed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Rentals</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleEditProfile}
          >
            <Ionicons name="person-outline" size={24} color="#6B7280" />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              const parentNavigation = navigation.getParent();
              if (parentNavigation) {
                parentNavigation.navigate('KYCVerification');
              }
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#6B7280" />
            <Text style={styles.menuText}>Identity Verification</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              const parentNavigation = navigation.getParent();
              if (parentNavigation) {
                parentNavigation.navigate('RentalRequests');
              }
            }}
          >
            <Ionicons name="document-text-outline" size={24} color="#6B7280" />
            <Text style={styles.menuText}>Rental Requests</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              const parentNavigation = navigation.getParent();
              if (parentNavigation) {
                parentNavigation.navigate('MyListings');
              }
            }}
          >
            <Ionicons name="list-outline" size={24} color="#6B7280" />
            <Text style={styles.menuText}>My Listings</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              const parentNavigation = navigation.getParent();
              if (parentNavigation) {
                parentNavigation.navigate('RentalHistory');
              }
            }}
          >
            <Ionicons name="time-outline" size={24} color="#6B7280" />
            <Text style={styles.menuText}>Rental History</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              const parentNavigation = navigation.getParent();
              if (parentNavigation) {
                parentNavigation.navigate('HelpSupport');
              }
            }}
          >
            <Ionicons name="help-circle-outline" size={24} color="#6B7280" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              const parentNavigation = navigation.getParent();
              if (parentNavigation) {
                parentNavigation.navigate('PaymobTest');
              }
            }}
          >
            <Ionicons name="card-outline" size={24} color="#6B7280" />
            <Text style={styles.menuText}>🧪 Test Paymob Payment</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="outline"
          style={styles.signOutButton}
        />
      </ScrollView>

      {/* Subscription Modal */}
      <SubscriptionModal
        visible={subscriptionModalVisible}
        onClose={() => setSubscriptionModalVisible(false)}
        onSubscriptionChanged={(subscription) => {
          console.log('Subscription changed:', subscription);
          // Refresh tier info if needed
          loadTierInfo();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  kycVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kycVerifiedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  email: {
    fontSize: 16,
    color: '#6B7280',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  verificationText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
    marginLeft: 4,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4639eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  signOutButton: {
    marginTop: 16,
  },
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E0E7FF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  tierTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  tierStats: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  tierStat: {
    flex: 1,
    alignItems: 'center',
  },
  tierDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  tierStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4639eb',
    marginBottom: 4,
  },
  tierStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  nextTierInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4639eb',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E7FF',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4639eb',
    borderRadius: 4,
  },
  nextTierBenefit: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  maxTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  maxTierText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  verificationPrompt: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E0E7FF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  verificationPromptContent: {
    alignItems: 'center',
  },
  verificationPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  verificationPromptMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  verificationButton: {
    minWidth: 160,
  },
  walletCard: {
    backgroundColor: '#4639eb',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  walletAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  walletLoader: {
    marginVertical: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    textAlign: 'center',
    marginBottom: 16,
  },
  walletActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    gap: 16,
  },
  withdrawButton: {
    minWidth: 140,
  },
  kycWarning: {
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ProfileScreen;
