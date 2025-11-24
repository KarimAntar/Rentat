/**
 * Handover Status Component
 * Displays the current handover confirmation status
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getHandoverStatus, getPendingConfirmationMessage } from '../../services/handover';

interface HandoverStatusProps {
  rental: any;
  isOwner: boolean;
  currentUserId: string;
}

export const HandoverStatus: React.FC<HandoverStatusProps> = ({
  rental,
  isOwner,
  currentUserId,
}) => {
  const handoverStatus = getHandoverStatus(rental);
  const message = getPendingConfirmationMessage(rental, currentUserId);

  const getStatusColor = () => {
    if (handoverStatus.bothConfirmed) {
      return '#4CAF50'; // Green - completed
    } else if (handoverStatus.renterConfirmed || handoverStatus.ownerConfirmed) {
      return '#FFA500'; // Orange - partially confirmed
    } else {
      return '#FF6B6B'; // Red - waiting
    }
  };

  const getStatusIcon = () => {
    if (handoverStatus.bothConfirmed) {
      return '✓✓';
    } else if (handoverStatus.renterConfirmed || handoverStatus.ownerConfirmed) {
      return '✓';
    } else {
      return '○';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Handover Status</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.badgeText}>{getStatusIcon()}</Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Owner:</Text>
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: handoverStatus.ownerConfirmed
                  ? '#4CAF50'
                  : '#E0E0E0',
              },
            ]}
          >
            <Text
              style={[
                styles.statusIndicatorText,
                { color: handoverStatus.ownerConfirmed ? '#FFF' : '#666' },
              ]}
            >
              {handoverStatus.ownerConfirmed ? 'Confirmed' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Renter:</Text>
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: handoverStatus.renterConfirmed
                  ? '#4CAF50'
                  : '#E0E0E0',
              },
            ]}
          >
            <Text
              style={[
                styles.statusIndicatorText,
                { color: handoverStatus.renterConfirmed ? '#FFF' : '#666' },
              ]}
            >
              {handoverStatus.renterConfirmed ? 'Confirmed' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.messageContainer}>
        <Text style={styles.message}>{message}</Text>
      </View>

      {handoverStatus.bothConfirmed && (
        <View style={styles.completedContainer}>
          <Text style={styles.completedText}>
            🎉 Handover completed! Rental is now active.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  completedContainer: {
    marginTop: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
  },
  completedText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
    textAlign: 'center',
  },
});
