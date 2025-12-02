import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Deposit } from '../../types/dashboard';

interface DepositHistoryCardProps {
  deposit: Deposit;
  onPress?: () => void;
}

export const DepositHistoryCard: React.FC<DepositHistoryCardProps> = ({
  deposit,
  onPress,
}) => {
  const getStatusColor = (status: Deposit['status']) => {
    switch (status) {
      case 'held':
        return '#FFA500'; // Orange
      case 'released':
        return '#4CAF50'; // Green
      case 'partial_refund':
        return '#2196F3'; // Blue
      default:
        return '#9E9E9E'; // Gray
    }
  };

  const getStatusText = (status: Deposit['status']) => {
    switch (status) {
      case 'held':
        return 'Held';
      case 'released':
        return 'Released';
      case 'partial_refund':
        return 'Partial Refund';
      default:
        return status;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Security Deposit</Text>
          <Text style={styles.date}>
            {formatDate(deposit.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(deposit.status) }]}>
          <Text style={styles.statusText}>{getStatusText(deposit.status)}</Text>
        </View>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Amount:</Text>
        <Text style={styles.amount}>
          {formatAmount(deposit.amount, deposit.currency)}
        </Text>
      </View>

      {deposit.status === 'partial_refund' && deposit.partialAmount && (
        <View style={styles.partialAmountContainer}>
          <Text style={styles.partialAmountLabel}>Refunded:</Text>
          <Text style={styles.partialAmount}>
            {formatAmount(deposit.partialAmount, deposit.currency)}
          </Text>
        </View>
      )}

      {deposit.releaseReason && (
        <View style={styles.reasonContainer}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText}>{deposit.releaseReason}</Text>
        </View>
      )}

      {deposit.holdReason && deposit.status === 'held' && (
        <View style={styles.reasonContainer}>
          <Text style={styles.reasonLabel}>Hold Reason:</Text>
          <Text style={styles.reasonText}>{deposit.holdReason}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  partialAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  partialAmountLabel: {
    fontSize: 14,
    color: '#666',
  },
  partialAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  reasonContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  reasonLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
