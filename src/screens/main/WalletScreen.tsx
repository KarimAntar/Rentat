import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/ui/Button';
import { showAlert } from '../../contexts/ModalContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUserBalance, useUserTransactions } from '../../hooks/useFirestore';
import { commissionService } from '../../services/commission';
import { diditKycService } from '../../services/diditKyc';
import { db, collections } from '../../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { WalletBalanceCard } from '../../components/wallet/WalletBalanceCard';

interface CommissionTransaction {
  id: string;
  rentalId: string;
  amount: number;
  ownerPayout: number;
  rate: number;
  tier: string;
  category: string;
  date: Date;
}

const WalletScreen: React.FC = () => {
  const { user } = useAuthContext();
  const { balance, loading: balanceLoading, error: balanceError } = useUserBalance(user?.uid || null);
  const { data: transactions, loading: transactionsLoading, error: transactionsError } = useUserTransactions(user?.uid || null);
  const [commissionHistory, setCommissionHistory] = useState<CommissionTransaction[]>([]);
  const [commissionLoading, setCommissionLoading] = useState(true);
  const [totalCommissionPaid, setTotalCommissionPaid] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'commissions'>('all');
  const [kycVerified, setKycVerified] = useState(false);
  const [kycLoading, setKycLoading] = useState(true);

  useEffect(() => {
    loadCommissionHistory();
    checkKycStatus();
  }, [user]);

  const checkKycStatus = async () => {
    if (!user) return;
    
    try {
      setKycLoading(true);
      const isVerified = await diditKycService.isUserKycVerified(user.uid);
      setKycVerified(isVerified);
    } catch (error) {
      console.error('Error checking KYC status:', error);
    } finally {
      setKycLoading(false);
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
        showAlert(
          'Verification Required',
          'You need to complete identity verification before you can withdraw funds. This helps keep our community safe and secure.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Verify Now',
              onPress: () => {
                // Navigate to verification screen
                console.log('Navigate to KYC verification');
              }
            }
          ]
        );
      } else if (errorMessage === 'KYC_IN_PROGRESS') {
        showAlert(
          'Verification In Progress',
          'Your identity verification is currently in progress. Please wait for it to be completed before withdrawing funds.'
        );
      } else if (errorMessage === 'KYC_IN_REVIEW') {
        showAlert(
          'Verification Under Review',
          'Your identity verification is under review. We will notify you once it has been completed.'
        );
      } else if (errorMessage === 'KYC_REJECTED') {
        showAlert(
          'Verification Rejected',
          'Your identity verification was rejected. Please contact support for more information.'
        );
      } else if (errorMessage === 'KYC_EXPIRED') {
        showAlert(
          'Verification Expired',
          'Your identity verification has expired. Please complete the verification process again.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Verify Again',
              onPress: () => {
                // Navigate to verification screen
                console.log('Navigate to KYC verification');
              }
            }
          ]
        );
      } else {
        showAlert('Error', 'Failed to process withdrawal. Please try again.');
      }
    }
  };

  const loadCommissionHistory = async () => {
    if (!user) return;
    
    try {
      setCommissionLoading(true);
      const history = await commissionService.getUserCommissionHistory(user.uid, 50);
      setCommissionHistory(history);
      
      // Calculate total commission paid
      const total = history.reduce((sum, transaction) => sum + transaction.amount, 0);
      setTotalCommissionPaid(total);
    } catch (error) {
      console.error('Error loading commission history:', error);
    } finally {
      setCommissionLoading(false);
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

  const [tierInfo, setTierInfo] = useState<{
    currentTier: string;
    completedRentals: number;
    nextTier?: {
      name: string;
      rentalsNeeded: number;
      currentRate: number;
      nextRate: number;
    };
  } | null>(null);

  const [tierLoading, setTierLoading] = useState(false);

  const loadTierInfo = async () => {
    if (!user) return;

    try {
      setTierLoading(true);
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
      setTierLoading(false);
    }
  };

  useEffect(() => {
    loadCommissionHistory();
    checkKycStatus();
    loadTierInfo();
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Enhanced Wallet Balance Card with breakdown */}
        {user && (
          <WalletBalanceCard
            userId={user.uid}
            onRefresh={() => {
              // Optional: Trigger any additional refresh logic
              loadCommissionHistory();
              loadTierInfo();
            }}
          />
        )}

        {/* Commission Tier Card */}
        {tierLoading ? (
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

        <View style={styles.earningsCard}>
          <Text style={styles.cardTitle}>Earnings Summary</Text>
          <View style={styles.earningsGrid}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>EGP 0.00</Text>
              <Text style={styles.earningsLabel}>This Month</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsAmount}>EGP 0.00</Text>
              <Text style={styles.earningsLabel}>Total Earned</Text>
            </View>
          </View>
        </View>

        {/* Commission Summary Card */}
        {commissionHistory.length > 0 && (
          <View style={styles.commissionCard}>
            <View style={styles.commissionHeader}>
              <Ionicons name="trending-down" size={24} color="#4639eb" />
              <Text style={styles.cardTitle}>Commission Summary</Text>
            </View>
            <View style={styles.commissionStats}>
              <View style={styles.commissionStat}>
                <Text style={styles.commissionAmount}>
                  ${(totalCommissionPaid / 100).toFixed(2)}
                </Text>
                <Text style={styles.commissionLabel}>Total Commission Paid</Text>
              </View>
              <View style={styles.commissionDivider} />
              <View style={styles.commissionStat}>
                <Text style={styles.commissionAmount}>
                  {commissionHistory.length}
                </Text>
                <Text style={styles.commissionLabel}>Transactions</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.viewDetailsButton}
              onPress={() => setActiveTab('commissions')}
            >
              <Text style={styles.viewDetailsText}>View Commission History</Text>
              <Ionicons name="arrow-forward" size={16} color="#4639eb" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionRow}>
            <Ionicons name="card-outline" size={24} color="#4639eb" />
            <Text style={styles.actionText}>Payment Methods</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionRow}>
            <Ionicons name="receipt-outline" size={24} color="#4639eb" />
            <Text style={styles.actionText}>Transaction History</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionRow}>
            <Ionicons name="document-text-outline" size={24} color="#4639eb" />
            <Text style={styles.actionText}>Tax Documents</Text>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Transaction Tabs */}
        <View style={styles.transactionTabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              All Transactions
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'commissions' && styles.activeTab]}
            onPress={() => setActiveTab('commissions')}
          >
            <Text style={[styles.tabText, activeTab === 'commissions' && styles.activeTabText]}>
              Commission History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transaction List */}
        <View style={styles.recentTransactions}>
          {activeTab === 'all' ? (
            // All Transactions
            transactionsLoading ? (
              <ActivityIndicator size="large" color="#4639eb" style={{ marginTop: 32 }} />
            ) : transactions && transactions.length > 0 ? (
              <View>
                {transactions.map((transaction: any) => (
                  <View key={transaction.id} style={styles.transactionItem}>
                    <View style={styles.transactionIcon}>
                      <Ionicons 
                        name={transaction.type === 'credit' ? 'arrow-down' : 'arrow-up'} 
                        size={20} 
                        color={transaction.type === 'credit' ? '#10B981' : '#EF4444'} 
                      />
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionTitle}>{transaction.description}</Text>
                      <Text style={styles.transactionDate}>
                        {transaction.date?.toDate().toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      { color: transaction.type === 'credit' ? '#10B981' : '#EF4444' }
                    ]}>
                      {transaction.type === 'credit' ? '+' : '-'}${(transaction.amount / 100).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>
                  Your rental earnings and payments will appear here
                </Text>
              </View>
            )
          ) : (
            // Commission History
            commissionLoading ? (
              <ActivityIndicator size="large" color="#4639eb" style={{ marginTop: 32 }} />
            ) : commissionHistory.length > 0 ? (
              <View>
                {commissionHistory.map((transaction) => (
                  <View key={transaction.id} style={styles.commissionItem}>
                    <View style={styles.commissionItemHeader}>
                      <View style={styles.commissionItemIcon}>
                        <Ionicons name="pricetag" size={20} color="#4639eb" />
                      </View>
                      <View style={styles.commissionItemDetails}>
                        <Text style={styles.commissionItemTitle}>
                          {transaction.category} Rental
                        </Text>
                        <Text style={styles.commissionItemDate}>
                          {transaction.date.toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.commissionItemAmounts}>
                        <Text style={styles.commissionItemPayout}>
                          ${(transaction.ownerPayout / 100).toFixed(2)}
                        </Text>
                        <Text style={styles.commissionItemFee}>
                          -{(transaction.rate * 100).toFixed(0)}% (${(transaction.amount / 100).toFixed(2)})
                        </Text>
                      </View>
                    </View>
                    <View style={styles.commissionItemFooter}>
                      <View style={styles.tierBadge}>
                        <Text style={styles.tierBadgeText}>{transaction.tier}</Text>
                      </View>
                      <Text style={styles.rentalIdText}>
                        Rental: {transaction.rentalId.slice(0, 8)}...
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="pricetag-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No commission history</Text>
                <Text style={styles.emptySubtext}>
                  Commission fees from completed rentals will appear here
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>
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
  balanceCard: {
    backgroundColor: '#4639eb',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#C7D2FE',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  balanceLoader: {
    marginVertical: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    textAlign: 'center',
    marginBottom: 16,
  },
  kycWarning: {
    fontSize: 12,
    color: '#F59E0B',
    textAlign: 'center',
    marginTop: 8,
  },
  balanceActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    gap: 16,
  },
  addFundsButton: {
    minWidth: 120,
  },
  withdrawButton: {
    minWidth: 120,
  },
  earningsCard: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  earningsItem: {
    alignItems: 'center',
  },
  earningsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  earningsLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  quickActions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    margin: 20,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  recentTransactions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  commissionCard: {
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
    shadowRadius: 2,
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  commissionStats: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  commissionStat: {
    flex: 1,
    alignItems: 'center',
  },
  commissionDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  commissionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4639eb',
    marginBottom: 4,
  },
  commissionLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4639eb',
  },
  transactionTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#4639eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  commissionItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commissionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  commissionItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commissionItemDetails: {
    flex: 1,
  },
  commissionItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  commissionItemDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  commissionItemAmounts: {
    alignItems: 'flex-end',
  },
  commissionItemPayout: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  commissionItemFee: {
    fontSize: 12,
    color: '#EF4444',
  },
  commissionItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4639eb',
  },
  rentalIdText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  // Wallet related styles - Balance Card
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
  walletActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    gap: 16,
  },
  // Tier related styles - Commission Tier Card
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
    gap: 12,
  },
  tierHeaderText: {
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
});

export default WalletScreen;
