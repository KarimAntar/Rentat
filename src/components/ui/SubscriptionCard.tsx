import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SubscriptionTier } from '../../services/subscriptions';

interface SubscriptionCardProps {
  tier: SubscriptionTier;
  isSelected?: boolean;
  isCurrentPlan?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  tier,
  isSelected = false,
  isCurrentPlan = false,
  onSelect,
  disabled = false,
}) => {
  const formatPrice = (price: number) => {
    return `$${(price / 100).toFixed(2)}`;
  };

  const getBillingText = (billingCycle: 'monthly' | 'yearly') => {
    if (tier.price === 0) return '';
    return billingCycle === 'monthly' ? '/month' : '/year';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
        isCurrentPlan && styles.currentPlanContainer,
        disabled && styles.disabledContainer,
      ]}
      onPress={onSelect}
      disabled={disabled || isCurrentPlan}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isSelected && styles.selectedText]}>
            {tier.name}
          </Text>
          {tier.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Most Popular</Text>
            </View>
          )}
          {isCurrentPlan && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentText}>Current Plan</Text>
            </View>
          )}
        </View>

        <View style={styles.pricing}>
          <Text style={[styles.price, isSelected && styles.selectedText]}>
            {tier.price === 0 ? 'Free' : formatPrice(tier.price)}
          </Text>
          <Text style={[styles.billingCycle, isSelected && styles.selectedText]}>
            {getBillingText('monthly')}
          </Text>
        </View>

        {tier.yearlyPrice && (
          <Text style={[styles.yearlyPrice, isSelected && styles.selectedText]}>
            or {formatPrice(tier.yearlyPrice)} yearly (save 2 months!)
          </Text>
        )}
      </View>

      <Text style={[styles.description, isSelected && styles.selectedText]}>
        {tier.benefits[0]}
      </Text>

      <View style={styles.features}>
        {tier.features.slice(0, 4).map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Text style={[styles.checkmark, isSelected && styles.selectedText]}>✓</Text>
            <Text style={[styles.feature, isSelected && styles.selectedText]}>
              {feature}
            </Text>
          </View>
        ))}
        {tier.features.length > 4 && (
          <Text style={[styles.moreFeatures, isSelected && styles.selectedText]}>
            +{tier.features.length - 4} more features
          </Text>
        )}
      </View>

      {tier.badge && (
        <View style={[styles.badge, { backgroundColor: tier.badge.color }]}>
          <Text style={styles.badgeText}>{tier.badge.text}</Text>
        </View>
      )}

      {tier.trialDays && tier.trialDays > 0 && (
        <View style={styles.trialBadge}>
          <Text style={styles.trialText}>
            {tier.trialDays} day free trial
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
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
  currentPlanContainer: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  disabledContainer: {
    opacity: 0.5,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
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
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#059669',
  },
  billingCycle: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  yearlyPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  features: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 14,
    color: '#10B981',
    marginRight: 8,
    width: 16,
  },
  feature: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  moreFeatures: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
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
  trialBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  trialText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SubscriptionCard;
