import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BoostPackage } from '../../services/boost';

interface BoostCardProps {
  boostPackage: BoostPackage;
  isSelected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}

export const BoostCard: React.FC<BoostCardProps> = ({
  boostPackage,
  isSelected = false,
  onSelect,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
        disabled && styles.disabledContainer,
      ]}
      onPress={onSelect}
      disabled={disabled}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isSelected && styles.selectedText]}>
            {boostPackage.name}
          </Text>
          {boostPackage.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
        </View>
        <Text style={[styles.price, isSelected && styles.selectedText]}>
          ${(boostPackage.price / 100).toFixed(2)}
        </Text>
      </View>

      <Text style={[styles.description, isSelected && styles.selectedText]}>
        {boostPackage.description}
      </Text>

      <View style={styles.benefits}>
        {boostPackage.benefits.map((benefit, index) => (
          <View key={index} style={styles.benefitRow}>
            <Text style={[styles.bullet, isSelected && styles.selectedText]}>•</Text>
            <Text style={[styles.benefit, isSelected && styles.selectedText]}>
              {benefit}
            </Text>
          </View>
        ))}
      </View>

      {boostPackage.badge && (
        <View style={[styles.badge, { backgroundColor: boostPackage.badge.color }]}>
          <Text style={styles.badgeText}>{boostPackage.badge.text}</Text>
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
    marginVertical: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedContainer: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF4FF',
  },
  disabledContainer: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 8,
  },
  selectedText: {
    color: '#1E40AF',
  },
  popularBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  benefits: {
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
    width: 12,
  },
  benefit: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default BoostCard;
