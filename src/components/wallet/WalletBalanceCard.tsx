/**
 * Wallet Balance Card Component
 * Displays enhanced wallet balance with AVAILABLE/PENDING/LOCKED breakdown
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  getCreditsOnlyWalletBalance,
  formatCurrency,
  getBalanceTypeColor,
  calculateBalancePercentage,
  WalletBalance,
} from '../../services/wallet';

interface WalletBalanceCardProps {
  userId?: string;
  onRefresh?: () => void;
}

export const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  userId,
  onRefresh,
}) => {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
  }, [userId]);

  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCreditsOnlyWalletBalance(userId);
      setBalance(data);
      onRefresh?.();
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet balance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error || !balance) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'No balance data'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💰 Wallet Balance</Text>

      {/* Total Balance */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Balance</Text>
        <Text style={styles.totalAmount}>
          {formatCurrency(balance.total, balance.currency)}
        </Text>
      </View>

      {/* Balance Breakdown */}
      <View style={styles.breakdownContainer}>
        {/* Available */}
        <BalanceRow
          label="Available"
          amount={balance.available}
          currency={balance.currency}
          color={getBalanceTypeColor('available')}
          description="Can be withdrawn"
          percentage={calculateBalancePercentage(balance.available, balance.total)}
        />

        {/* Pending */}
        <BalanceRow
          label="Pending"
          amount={balance.pending}
          currency={balance.currency}
          color={getBalanceTypeColor('pending')}
          description="In active rentals"
          percentage={calculateBalancePercentage(balance.pending, balance.total)}
        />

        {/* Locked */}
        <BalanceRow
          label="Locked"
          amount={balance.locked}
          currency={balance.currency}
          color={getBalanceTypeColor('locked')}
          description="In disputes"
          percentage={calculateBalancePercentage(balance.locked, balance.total)}
        />
      </View>

      {/* Total Earnings */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Earnings:</Text>
          <Text style={styles.statValue}>
            {formatCurrency(balance.totalEarnings, balance.currency)}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Withdrawn:</Text>
          <Text style={styles.statValue}>
            {formatCurrency(balance.totalWithdrawn, balance.currency)}
          </Text>
        </View>
      </View>
    </View>
  );
};

interface BalanceRowProps {
  label: string;
  amount: number;
  currency: string;
  color: string;
  description: string;
  percentage: number;
}

const BalanceRow: React.FC<BalanceRowProps> = ({
  label,
  amount,
  currency,
  color,
  description,
  percentage,
}) => {
  return (
    <View style={styles.balanceRow}>
      <View style={styles.balanceHeader}>
        <View style={styles.balanceLabelContainer}>
          <View style={[styles.colorDot, { backgroundColor: color }]} />
          <Text style={styles.balanceLabel}>{label}</Text>
        </View>
        <Text style={styles.balanceAmount}>
          {formatCurrency(amount, currency)}
        </Text>
      </View>
      <View style={styles.balanceDetails}>
        <Text style={styles.balanceDescription}>{description}</Text>
        {percentage > 0 && (
          <Text style={styles.balancePercentage}>{percentage.toFixed(1)}%</Text>
        )}
      </View>
      {/* Progress Bar */}
      {percentage > 0 && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${percentage}%`, backgroundColor: color },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  totalContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4CAF50',
  },
  breakdownContainer: {
    marginBottom: 20,
  },
  balanceRow: {
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  balanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceDescription: {
    fontSize: 12,
    color: '#999',
  },
  balancePercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
  },
});
