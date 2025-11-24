/**
 * Confirm Handover Button Component
 * Allows owner/renter to confirm handover
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { 
  confirmHandoverAsRenter, 
  confirmHandoverAsOwner,
  canConfirmHandover 
} from '../../services/handover';

interface ConfirmHandoverButtonProps {
  rental: any;
  currentUserId: string;
  isOwner: boolean;
  onConfirm?: () => void;
}

export const ConfirmHandoverButton: React.FC<ConfirmHandoverButtonProps> = ({
  rental,
  currentUserId,
  isOwner,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  const canConfirm = canConfirmHandover(rental, currentUserId);

  const handleConfirm = async () => {
    Alert.alert(
      'Confirm Handover',
      isOwner
        ? 'Confirm that you have handed over the item to the renter?'
        : 'Confirm that you have received the item from the owner?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const result = isOwner
                ? await confirmHandoverAsOwner(rental.id)
                : await confirmHandoverAsRenter(rental.id);

              if (result.success) {
                Alert.alert(
                  'Success',
                  result.bothConfirmed
                    ? 'Both parties confirmed! Rental is now active.'
                    : 'Handover confirmed. Waiting for the other party to confirm.',
                  [{ text: 'OK', onPress: onConfirm }]
                );
              }
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message || 'Failed to confirm handover. Please try again.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!canConfirm) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={handleConfirm}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <Text style={styles.buttonText}>
          {isOwner ? 'Confirm Item Handover' : 'Confirm Item Received'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
