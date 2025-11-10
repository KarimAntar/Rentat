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
import { BoostCard } from './BoostCard';
import Button from './Button';
import { boostService, BoostPackage, BoostTransaction } from '../../services/boost';
import { useAuthContext } from '../../contexts/AuthContext';

interface BoostModalProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
  onBoostPurchased?: (boost: BoostTransaction) => void;
}

export const BoostModal: React.FC<BoostModalProps> = ({
  visible,
  onClose,
  itemId,
  itemTitle,
  onBoostPurchased,
}) => {
  const { user } = useAuthContext();
  const [boostPackages, setBoostPackages] = useState<BoostPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<BoostPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingActiveBoost, setCheckingActiveBoost] = useState(false);
  const [activeBoost, setActiveBoost] = useState<BoostTransaction | null>(null);

  useEffect(() => {
    if (visible) {
      loadBoostPackages();
      checkActiveBoost();
    }
  }, [visible, itemId]);

  const loadBoostPackages = async () => {
    try {
      const packages = boostService.getBoostPackages();
      setBoostPackages(packages);
    } catch (error) {
      console.error('Error loading boost packages:', error);
      Alert.alert('Error', 'Failed to load boost packages');
    }
  };

  const checkActiveBoost = async () => {
    if (!itemId) return;

    setCheckingActiveBoost(true);
    try {
      const boost = await boostService.getActiveBoost(itemId);
      setActiveBoost(boost);
    } catch (error) {
      console.error('Error checking active boost:', error);
    } finally {
      setCheckingActiveBoost(false);
    }
  };

  const handlePurchaseBoost = async () => {
    if (!selectedPackage || !user) return;

    setLoading(true);
    try {
      // In a real implementation, you would need to:
      // 1. Get payment method from user
      // 2. Process payment through Stripe
      // For now, we'll simulate the purchase

      Alert.alert(
        'Purchase Boost',
        `Are you sure you want to purchase "${selectedPackage.name}" for $${(selectedPackage.price / 100).toFixed(2)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Purchase',
            onPress: async () => {
              try {
                // Mock payment method ID - in real app, get from payment method selection
                const paymentMethodId = 'pm_mock_payment_method';

                const boostTransaction = await boostService.purchaseBoost(
                  itemId,
                  user.uid,
                  selectedPackage.id,
                  paymentMethodId
                );

                Alert.alert(
                  'Success!',
                  `Your item "${itemTitle}" has been boosted with ${selectedPackage.name}!`,
                  [{ text: 'OK', onPress: () => {
                    onBoostPurchased?.(boostTransaction);
                    onClose();
                  }}]
                );
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to purchase boost');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to initiate boost purchase');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedPackage(null);
    setActiveBoost(null);
    onClose();
  };

  if (checkingActiveBoost) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.container}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Checking boost status...</Text>
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
            <Text style={styles.title}>Boost Your Listing</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Increase visibility for "{itemTitle}"
          </Text>

          {activeBoost && (
            <View style={styles.activeBoostContainer}>
              <Text style={styles.activeBoostTitle}>Active Boost</Text>
              <Text style={styles.activeBoostText}>
                {activeBoost.packageType} boost active until {activeBoost.endDate.toLocaleDateString()}
              </Text>
              <Text style={styles.activeBoostNote}>
                You can upgrade or wait for it to expire before purchasing a new boost.
              </Text>
            </View>
          )}

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {boostPackages.map((boostPackage) => (
              <BoostCard
                key={boostPackage.id}
                boostPackage={boostPackage}
                isSelected={selectedPackage?.id === boostPackage.id}
                onSelect={() => setSelectedPackage(boostPackage)}
                disabled={!!activeBoost}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
              style={styles.cancelButton}
            />
            <Button
              title={loading ? 'Processing...' : `Boost for $${selectedPackage ? (selectedPackage.price / 100).toFixed(2) : '0.00'}`}
              onPress={handlePurchaseBoost}
              disabled={!selectedPackage || loading || !!activeBoost}
              loading={loading}
              style={styles.boostButton}
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
    maxHeight: '80%',
    minHeight: '60%',
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
  activeBoostContainer: {
    backgroundColor: '#FEF3C7',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  activeBoostTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  activeBoostText: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 8,
  },
  activeBoostNote: {
    fontSize: 12,
    color: '#78350F',
    fontStyle: 'italic',
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
  },
  boostButton: {
    flex: 2,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default BoostModal;
