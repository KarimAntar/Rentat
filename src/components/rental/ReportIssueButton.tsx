/**
 * Report Issue Button Component
 * Allows users to raise disputes on rentals
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { canRaiseDispute } from '../../services/disputes';

interface ReportIssueButtonProps {
  rental: any;
  currentUserId: string;
  onPress: () => void;
}

export const ReportIssueButton: React.FC<ReportIssueButtonProps> = ({
  rental,
  currentUserId,
  onPress,
}) => {
  const canReport = canRaiseDispute(rental, currentUserId);

  if (!canReport) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>⚠️ Report Issue</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
