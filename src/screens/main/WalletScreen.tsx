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
import { useAuthContext } from '../../contexts/AuthContext';
import { useUserBalance, useUserTransactions } from '../../hooks/useFirestore';
import { commissionService } from '../../services/commission';

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

  useEffect(() => {
    loadCommissionHistory();
  }, [user]);

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
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          {balanceLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" style={styles.balanceLoader} />
          ) : (
            <Text style={styles.balanceAmount}>
              EGP {balance.toFixed(2)}
            </Text>
          )}
          {balanceError && (
            <Text style={styles.errorText}>{balanceError}</Text>
          )}
          <View style={styles.balanceActions}>
            <Button
              title="Withdraw"
              onPress={() => console.log('Withdraw pressed')}
              style={styles.withdrawButton}
              size="small"
              disabled={balance <= 0}
            />
          </View>
        </View>

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
});

export default WalletScreen;
