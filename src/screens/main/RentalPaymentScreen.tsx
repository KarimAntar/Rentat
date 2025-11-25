import { showAlert } from '../../contexts/ModalContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import { useAuthContext } from '../../contexts/AuthContext';
import { RentalService } from '../../services/firestore';
import { Rental, RootStackParamList } from '../../types';
import Button from '../../components/ui/Button';
import { paymobService } from '../../config/paymob';

type RentalPaymentScreenRouteProp = RouteProp<RootStackParamList, 'RentalPayment'>;

const RentalPaymentScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RentalPaymentScreenRouteProp>();
  const { user } = useAuthContext();
  const appState = useRef(AppState.currentState);

  const { rentalId } = route.params;

  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [hasAttemptedPayment, setHasAttemptedPayment] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalButtons, setModalButtons] = useState<any[]>([]);
  const [modalType, setModalType] = useState<'info' | 'success' | 'warning' | 'error'>('info');

  useEffect(() => {
    loadRental();
  }, [rentalId]);

  // Auto-refresh when app returns to foreground (only if user attempted payment)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        rental &&
        hasAttemptedPayment
      ) {
        console.log('App returned to foreground, checking payment status...');
        checkPaymentStatus();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [rental, hasAttemptedPayment]);

  // Auto-refresh every 3 seconds ONLY if user has clicked "Pay Now" in this session
  useEffect(() => {
    if (!rental || rental.payment.paymentStatus !== 'pending' || !hasAttemptedPayment) {
      return;
    }

    const interval = setInterval(() => {
      console.log('Auto-checking payment status...');
      checkPaymentStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [rental?.payment.paymentStatus, hasAttemptedPayment]);

  const loadRental = async () => {
    try {
      setLoading(true);
      const rentalData = await RentalService.getRental(rentalId);
      
      if (!rentalData) {
        setModalTitle('Error');
        setModalMessage('Rental not found');
        setModalButtons([{ text: 'OK', onPress: () => { setModalVisible(false); navigation.goBack(); } }]);
        setModalType('error');
        setModalVisible(true);
        return;
      }

      if (rentalData.renterId !== user?.uid) {
        setModalTitle('Error');
        setModalMessage('You are not authorized to view this rental');
        setModalButtons([{ text: 'OK', onPress: () => { setModalVisible(false); navigation.goBack(); } }]);
        setModalType('error');
        setModalVisible(true);
        return;
      }

      setRental(rentalData);

      // If rental is already paid and active, redirect to orders
      if (rentalData.status === 'active' && rentalData.payment?.paymentStatus === 'succeeded') {
        setModalTitle('This rental has already been paid for.');
        setModalMessage('This rental has already been paid for.');
        setModalButtons([{ text: 'OK', onPress: () => { setModalVisible(false); navigation.navigate('Orders'); } }]);
        setModalType('info');
        setModalVisible(true);
        return;
      }
    } catch (error) {
      console.error('Error loading rental:', error);
      setModalTitle('Error');
      setModalMessage('Failed to load rental details');
      setModalButtons([{ text: 'OK', onPress: () => setModalVisible(false) }]);
      setModalType('error');
      setModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!rental || checkingStatus) return;

    try {
      setCheckingStatus(true);

      // 1. Check Firestore rental status first
      const updatedRental = await RentalService.getRental(rentalId);

      // Only proceed if this rental has an order ID (meaning payment was attempted)
      if (!updatedRental?.payment?.paymobOrderId) {
        setRental(updatedRental);
        return;
      }

      // Only show success if payment status is succeeded AND Paymob confirms it
      let paymobConfirmed = false;
      let paymobTxnId: string | undefined = undefined;
      if (updatedRental?.payment.paymentStatus === 'succeeded') {
        try {
          const authToken = await paymobService.authenticate();
          const response = await fetch(
            `https://accept.paymob.com/api/acceptance/transactions?order=${updatedRental.payment.paymobOrderId}&token=${authToken}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            const transactions = data.results || (Array.isArray(data) ? data : []);
            const successfulTxn = transactions.find((t: any) => t.success && !t.pending);
            if (successfulTxn) {
              paymobConfirmed = true;
              paymobTxnId = successfulTxn.id;
            }
          }
        } catch (err) {
          paymobConfirmed = false;
        }
      }

      // If Firestore shows succeeded and Paymob confirms, just update UI (webhook already processed)
      if (
        updatedRental?.payment.paymentStatus === 'succeeded' &&
        paymobConfirmed &&
        paymobTxnId &&
        updatedRental?.payment?.paymobTransactionId === paymobTxnId
      ) {
        setRental(updatedRental);
        // Don't show success alert - webhook already handled this
        return;
      }

      // 2. If still pending, check Paymob transaction status directly
      // Only check if user has actually attempted payment in this session
      if (updatedRental?.payment?.paymobOrderId && updatedRental?.payment.paymentStatus === 'pending' && hasAttemptedPayment) {
        const authToken = await paymobService.authenticate();
        const response = await fetch(
          `https://accept.paymob.com/api/acceptance/transactions?order=${updatedRental.payment.paymobOrderId}&token=${authToken}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const transactions = data.results || (Array.isArray(data) ? data : []);

          // Find successful transaction with matching amount and recent timestamp
          const successfulTxn = transactions.find((t: any) => {
            const isSuccess = t.success && !t.pending;
            const amountMatches = t.amount_cents === updatedRental.pricing.total * 100; // Paymob uses cents
            const isRecent = t.created_at && (Date.now() - new Date(t.created_at).getTime()) < 300000; // Within 5 minutes

            return isSuccess && amountMatches && isRecent;
          });

          if (successfulTxn) {
            // Don't update Firestore from client - let webhook handle it
            // Just show success message and navigate
            setRental({
              ...updatedRental,
              payment: {
                ...updatedRental.payment,
                paymentStatus: 'succeeded',
                paymobTransactionId: successfulTxn.id,
              },
            });
            showAlert(
              'Payment Successful',
              'Your payment has been processed successfully!',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('Orders'),
                },
              ]
            );
            return;
          }
        }
      }

      // If still not succeeded, update state with latest rental
      if (updatedRental) {
        setRental(updatedRental);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const openPaymentGateway = async () => {
    if (!rental) {
      showAlert('Error', 'Rental not loaded');
      return;
    }

    try {
      setPaymentLoading(true);

      // Use cloud function to create fresh payment key (avoids client-side permission issues)
      console.log('Refreshing payment key via cloud function...');
      const refreshResult = await RentalService.refreshPaymentKey(rental.id);

      if (!refreshResult.success) {
        throw new Error('Failed to refresh payment key');
      }

      console.log('Payment key refreshed successfully');

      // Reload rental with updated payment info from cloud function
      await loadRental();

      const iframeId = (process.env as any).EXPO_PUBLIC_PAYMOB_IFRAME_ID;

      if (!iframeId) {
        throw new Error('Paymob iframe ID not configured');
      }

      const paymobUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${refreshResult.paymentKey}`;

      console.log('Opening payment gateway...');

      const supported = await Linking.canOpenURL(paymobUrl);
      if (supported) {
        // Mark that user has attempted payment in this session
        setHasAttemptedPayment(true);
        await Linking.openURL(paymobUrl);

        // Start checking status after opening payment gateway
        setTimeout(() => checkPaymentStatus(), 2000);
      } else {
        throw new Error('Cannot open payment gateway URL');
      }
    } catch (error: any) {
      console.error('Error opening payment gateway:', error);
      showAlert('Error', `Failed to open payment gateway: ${error.message || 'Unknown error'}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  const renderPaymentSummary = () => {
    if (!rental) return null;

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Payment Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rental Duration</Text>
          <Text style={styles.summaryValue}>{rental.pricing.totalDays} days</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Daily Rate</Text>
          <Text style={styles.summaryValue}>
            {rental.pricing.dailyRate} {rental.pricing.currency}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>
            {rental.pricing.subtotal} {rental.pricing.currency}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Platform Fee</Text>
          <Text style={styles.summaryValue}>
            {rental.pricing.platformFee} {rental.pricing.currency}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Security Deposit</Text>
          <Text style={styles.summaryValue}>
            {rental.pricing.securityDeposit} {rental.pricing.currency}
          </Text>
        </View>

        {rental.pricing.deliveryFee && rental.pricing.deliveryFee > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>
              {rental.pricing.deliveryFee} {rental.pricing.currency}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>
            {rental.pricing.total} {rental.pricing.currency}
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color="#4639eb" />
          <Text style={styles.infoText}>
            The security deposit will be refunded after the rental is completed and the item is returned in good condition.
          </Text>
        </View>
      </View>
    );
  };

  const renderPaymentStatus = () => {
    if (!rental) return null;

    const statusConfig = {
      pending: {
        color: '#F59E0B',
        bg: '#FEF3C7',
        icon: 'time-outline',
        title: 'Payment Pending',
        message: 'Complete your payment to confirm this rental',
      },
      succeeded: {
        color: '#10B981',
        bg: '#D1FAE5',
        icon: 'checkmark-circle',
        title: 'Payment Successful',
        message: 'Your payment has been processed successfully',
      },
      failed: {
        color: '#EF4444',
        bg: '#FEE2E2',
        icon: 'close-circle',
        title: 'Payment Declined',
        message: 'Your payment was declined. Click "Pay Now" below to create a fresh payment session and try again.',
      },
    };

    const status = rental.payment.paymentStatus as keyof typeof statusConfig;
    const config = statusConfig[status] || statusConfig.pending;

    return (
      <View style={[styles.statusCard, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon as any} size={48} color={config.color} />
        <Text style={[styles.statusTitle, { color: config.color }]}>{config.title}</Text>
        <Text style={styles.statusMessage}>{config.message}</Text>
        
        {checkingStatus && (
          <ActivityIndicator size="small" color={config.color} style={styles.statusLoader} />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4639eb" />
          <Text style={styles.loadingText}>Loading payment details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderPaymentStatus()}
        {renderPaymentSummary()}

        {rental?.payment.paymentStatus === 'pending' && (
          <>
            <Button
              title="Pay Now"
              onPress={openPaymentGateway}
              loading={paymentLoading}
              disabled={paymentLoading}
              variant="primary"
              style={styles.payButton}
            />

            <View style={styles.testCardsBox}>
              <Text style={styles.testCardsTitle}>ًںژ´ Test Card (Sandbox)</Text>
              <Text style={styles.testCardsText}>
                Card: 4987654321098769{'\n'}
                Expiry: Any future date{'\n'}
                CVV: Any 3 digits
              </Text>
            </View>
          </>
        )}

        {rental?.payment.paymentStatus === 'succeeded' && (
          <Button
            title="View Order Details"
            onPress={() => navigation.navigate('OrderDetails', { rentalId: rental!.id })}
            variant="outline"
            style={styles.viewOrderButton}
          />
        )}

        {rental?.payment.paymentStatus === 'failed' && (
          <Button
            title="Try Again"
            onPress={openPaymentGateway}
            loading={paymentLoading}
            disabled={paymentLoading}
            variant="primary"
            style={styles.payButton}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  statusCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
  },
  statusMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  statusLoader: {
    marginTop: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4639eb',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 18,
  },
  payButton: {
    marginBottom: 16,
  },
  viewOrderButton: {
    marginBottom: 16,
  },
  testCardsBox: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  testCardsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  testCardsText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 20,
  },
});

export default RentalPaymentScreen;


