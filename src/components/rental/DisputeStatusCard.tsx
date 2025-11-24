/**
 * Dispute Status Card Component
 * Displays the current dispute status and resolution
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import {
  getDisputeStatus,
  getDisputeOutcomeMessage,
  getDisputeStatusColor,
  getDisputeStatusLabel,
} from '../../services/disputes';

interface DisputeStatusCardProps {
  rental: any;
  userRole: 'owner' | 'renter';
  currentUserId: string;
}

export const DisputeStatusCard: React.FC<DisputeStatusCardProps> = ({
  rental,
  userRole,
  currentUserId,
}) => {
  const dispute = getDisputeStatus(rental);

  if (!dispute) {
    return null;
  }

  const statusColor = getDisputeStatusColor(dispute.status);
  const statusLabel = getDisputeStatusLabel(dispute.status);
  const outcomeMessage = getDisputeOutcomeMessage(rental, currentUserId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚠️ Dispute Status</Text>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Raised by:</Text>
          <Text style={styles.value}>
            {dispute.raisedBy === currentUserId
              ? 'You'
              : dispute.raisedBy === rental.ownerId
              ? 'Owner'
              : 'Renter'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Date:</Text>
          <Text style={styles.value}>
            {dispute.raisedAt.toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.reasonContainer}>
          <Text style={styles.label}>Reason:</Text>
          <Text style={styles.reasonText}>{dispute.reason}</Text>
        </View>

        {dispute.evidence && dispute.evidence.length > 0 && (
          <View style={styles.evidenceContainer}>
            <Text style={styles.label}>Evidence:</Text>
            <View style={styles.evidenceGrid}>
              {dispute.evidence.slice(0, 3).map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={styles.evidenceImage}
                />
              ))}
              {dispute.evidence.length > 3 && (
                <View style={styles.moreEvidenceBadge}>
                  <Text style={styles.moreEvidenceText}>
                    +{dispute.evidence.length - 3}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {dispute.status === 'open' && (
          <View style={styles.pendingContainer}>
            <Text style={styles.pendingText}>
              🕐 Waiting for moderator review...
            </Text>
          </View>
        )}

        {dispute.status === 'under_review' && (
          <View style={styles.reviewContainer}>
            <Text style={styles.reviewText}>
              👨‍⚖️ Dispute is under review by our team
            </Text>
          </View>
        )}

        {dispute.status === 'resolved' && dispute.resolution && (
          <View style={styles.resolutionContainer}>
            <Text style={styles.resolutionTitle}>Resolution</Text>
            <Text style={styles.resolutionMessage}>{outcomeMessage}</Text>
            {dispute.resolution.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Moderator Notes:</Text>
                <Text style={styles.notesText}>
                  {dispute.resolution.notes}
                </Text>
              </View>
            )}
            <Text style={styles.resolutionDate}>
              Resolved on {dispute.resolution.resolvedAt.toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 2,
    borderColor: '#FF6B6B',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#333',
  },
  reasonContainer: {
    marginTop: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
    lineHeight: 20,
  },
  evidenceContainer: {
    marginTop: 8,
  },
  evidenceGrid: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  evidenceImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  moreEvidenceBadge: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreEvidenceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  pendingContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  pendingText: {
    fontSize: 14,
    color: '#E65100',
    textAlign: 'center',
  },
  reviewContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  reviewText: {
    fontSize: 14,
    color: '#1565C0',
    textAlign: 'center',
  },
  resolutionContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  resolutionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  resolutionMessage: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
  },
  notesContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 6,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  resolutionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
});
