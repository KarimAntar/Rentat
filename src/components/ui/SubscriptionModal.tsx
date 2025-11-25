import { showAlert } from '../../contexts/ModalContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SubscriptionCard } from './SubscriptionCard';
import Button from './Button';
import { subscriptionService, SubscriptionTier, UserSubscription } from '../../services/subscriptions';
import { useAuthContext } from '../../contexts/AuthContext';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscriptionChanged?: (subscription: UserSubscription) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscriptionChanged,
}) => {
  const { user } = useAuthContext();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);

  useEffect(() => {
    if (visible) {
      loadTiers();
      checkCurrentSubscription();
    }
  }, [visible]);

  const loadTiers = async () => {
    try {
      const subscriptionTiers = subscriptionService.getSubscriptionTiers();
      setTiers(subscriptionTiers);
    } catch (error) {
      console.error('Error loading subscription tiers:', error);
      showAlert('Error', 'Failed to load subscription options');
    }
  };

  const checkCurrentSubscription = async () => {
    if (!user) return;

    setCheckingSubscription(true);
    try {
      const subscription = await subscriptionService.getUserSubscription(user.uid);
      setCurrentSubscription(subscription);

      // Pre-select current tier if exists
      if (subscription) {
        const currentTier = subscriptionService.getSubscriptionTier(subscription.tierId);
        if (currentTier) {
          setSelectedTier(currentTier);
          setBillingCycle(subscription.billingCycle);
        }
      }
    } catch (error) {
      console.error('Error checking current subscription:', error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedTier || !user) return;

    // Check if this is the current plan
    if (currentSubscription && currentSubscription.tierId === selectedTier.id) {
      showAlert('Already Subscribed', 'You are already subscribed to this plan.');
      return;
    }

    setLoading(true);
    try {
      if (currentSubscription) {
        // Change existing subscription
        showAlert(
          'Change Subscription',
          `Are you sure you want to ${selectedTier.price > (subscriptionService.getSubscriptionTier(currentSubscription.tierId)?.price || 0) ? 'upgrade' : 'downgrade'} to ${selectedTier.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              onPress: async () => {
                try {
                  const updatedSubscription = await subscriptionService.changeSubscription(
                    user.uid,
                    selectedTier.id
                  );

                  showAlert(
                    'Subscription Updated!',
                    `Your subscription has been changed to ${selectedTier.name}.`,
                    [{ text: 'OK', onPress: () => {
                      onSubscriptionChanged?.(updatedSubscription);
                      onClose();
                    }}]
                  );
                } catch (error: any) {
                  showAlert('Error', error.message || 'Failed to change subscription');
                }
              },
            },
          ]
        );
      } else {
        // New subscription
        const amount = billingCycle === 'yearly' ? (selectedTier.yearlyPrice || selectedTier.price * 12) : selectedTier.price;

        showAlert(
          'Subscribe to Plan',
          `Subscribe to ${selectedTier.name} for ${billingCycle === 'yearly' ? 'yearly' : 'monthly'}? ${selectedTier.trialDays ? `Includes ${selectedTier.trialDays} day free trial.` : ''}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Subscribe',
              onPress: async () => {
                try {
                  // Mock payment method ID - in real app, get from payment method selection
                  const paymentMethodId = 'pm_mock_payment_method';

                  const newSubscription = await subscriptionService.subscribe(
                    user.uid,
                    selectedTier.id,
                    billingCycle,
                    paymentMethodId
                  );

                  showAlert(
                    'Subscription Successful!',
                    `Welcome to ${selectedTier.name}! ${selectedTier.trialDays ? `Your ${selectedTier.trialDays} day free trial has started.` : 'Your subscription is now active.'}`,
                    [{ text: 'OK', onPress: () => {
                      onSubscriptionChanged?.(newSubscription);
                      onClose();
                    }}]
                  );
                } catch (error: any) {
                  showAlert('Error', error.message || 'Failed to subscribe');
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!currentSubscription || !user) return;

    showAlert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await subscriptionService.cancelSubscription(user.uid, 'User requested cancellation');

              showAlert(
                'Subscription Cancelled',
                'Your subscription has been cancelled. You will retain access to premium features until the end of your current billing period.',
                [{ text: 'OK', onPress: onClose }]
              );
            } catch (error: any) {
              showAlert('Error', error.message || 'Failed to cancel subscription');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setSelectedTier(null);
    setCurrentSubscription(null);
    onClose();
  };

  if (checkingSubscription) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.container}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading subscription details...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {currentSubscription ? 'Manage Subscription' : 'Choose Your Plan'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeText}>âœ•</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            {currentSubscription
              ? 'Upgrade, downgrade, or manage your current subscription'
              : 'Select the perfect plan for your rental needs'
            }
          </Text>

          {/* Billing Cycle Toggle */}
          {!currentSubscription && (
            <View style={styles.billingToggle}>
              <TouchableOpacity
                style={[styles.billingOption, billingCycle === 'monthly' && styles.billingOptionActive]}
                onPress={() => setBillingCycle('monthly')}
              >
                <Text style={[styles.billingText, billingCycle === 'monthly' && styles.billingTextActive]}>
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.billingOption, billingCycle === 'yearly' && styles.billingOptionActive]}
                onPress={() => setBillingCycle('yearly')}
              >
                <Text style={[styles.billingText, billingCycle === 'yearly' && styles.billingTextActive]}>
                  Yearly
                </Text>
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Save 17%</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {tiers.map((tier) => (
              <SubscriptionCard
                key={tier.id}
                tier={tier}
                isSelected={selectedTier?.id === tier.id}
                isCurrentPlan={currentSubscription?.tierId === tier.id}
                onSelect={() => setSelectedTier(tier)}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            {currentSubscription && (
            <Button
              title="Cancel Subscription"
              variant="outline"
              onPress={handleCancelSubscription}
              style={styles.cancelButton}
              disabled={loading}
            />
            )}
            <Button
              title={
                currentSubscription
                  ? selectedTier?.id === currentSubscription.tierId
                    ? 'Current Plan'
                    : selectedTier && selectedTier.price > (subscriptionService.getSubscriptionTier(currentSubscription.tierId)?.price || 0)
                    ? 'Upgrade Plan'
                    : 'Change Plan'
                  : loading
                  ? 'Processing...'
                  : `Subscribe to ${selectedTier?.name || 'Plan'}`
              }
              onPress={handleSubscribe}
              disabled={Boolean(
                !selectedTier ||
                loading ||
                (currentSubscription && selectedTier.id === currentSubscription.tierId)
              )}
              loading={loading}
              style={styles.subscribeButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 4,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
    position: 'relative',
  },
  billingOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  billingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  billingTextActive: {
    color: '#111827',
  },
  savingsBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#EF4444',
  },
  subscribeButton: {
    flex: 2,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default SubscriptionModal;


