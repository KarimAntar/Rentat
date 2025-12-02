import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Rental } from '../../types/index';

interface ActiveOrderCardProps {
  order: Rental;
  onPress?: () => void;
}

const { width } = Dimensions.get('window');

export const ActiveOrderCard: React.FC<ActiveOrderCardProps> = ({ order, onPress }) => {
  const getStatusText = (status: Rental['status']) => {
    switch (status) {
      case 'approved':
        return 'Payment Required';
      case 'awaiting_handover':
        return 'Ready for Pickup';
      case 'active':
        return 'In Progress';
      case 'pending':
        return 'Processing';
      case 'rejected':
        return 'Rejected';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getStatusColor = (status: Rental['status']) => {
    switch (status) {
      case 'approved':
        return '#FF9800'; // Orange
      case 'awaiting_handover':
        return '#2196F3'; // Blue
      case 'active':
        return '#4CAF50'; // Green
      case 'pending':
        return '#9E9E9E'; // Gray
      case 'rejected':
        return '#F44336'; // Red
      case 'completed':
        return '#4CAF50'; // Green
      case 'cancelled':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Gray
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };

  const formatAmount = (amount: number, currency: string = 'EGP') => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  // Get primary image from the rental item
  const itemImage = order.itemId ? '' : ''; // We'll fetch this from item data

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          Rental Item
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: itemImage || 'https://via.placeholder.com/60x60' }}
            style={styles.itemImage}
            defaultSource={require('../../../assets/logo.png')}
          />
        </View>

        <View style={styles.details}>
          <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>From:</Text>
            <Text style={styles.dateValue}>
              {formatDate(order.dates.confirmedStart || order.dates.requestedStart)}
            </Text>
          </View>

          <View style={styles.dateContainer}>
            <Text style={styles.dateLabel}>To:</Text>
            <Text style={styles.dateValue}>
              {formatDate(order.dates.confirmedEnd || order.dates.requestedEnd)}
            </Text>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.amount}>
              {formatAmount(order.pricing.total, order.pricing.currency)}
            </Text>
          </View>
        </View>
      </View>

      {order.status === 'approved' && (
        <View style={styles.actionRequired}>
          <Text style={styles.actionText}>Payment Required</Text>
        </View>
      )}

      {order.status === 'awaiting_handover' && order.handover && (
        <View style={styles.actionRequired}>
          <Text style={styles.actionText}>Confirm Handover</Text>
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
    marginRight: 12,
    width: width * 0.85, // Wider card
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
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flexDirection: 'row',
  },
  imageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  details: {
    flex: 1,
    justifyContent: 'space-between',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
    width: 30,
  },
  dateValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  priceContainer: {
    marginTop: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  actionRequired: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#FF9800',
  },
  actionText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
    textAlign: 'center',
  },
});
