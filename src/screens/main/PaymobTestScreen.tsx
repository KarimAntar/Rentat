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
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/ui/Button';
import { paymobService } from '../../config/paymob';
import { useAuthContext } from '../../contexts/AuthContext';

const PaymobTestScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const appState = useRef(AppState.currentState);

  // Payment state
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderStatus, setOrderStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Auto-refresh when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        orderId
      ) {
        // App has come to foreground, check payment status
        console.log('App returned to foreground, checking payment status...');
        checkOrderStatus();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [orderId]);

  // Auto-refresh every 2 seconds when order exists and not paid/failed
  useEffect(() => {
    if (!orderId || orderStatus?.is_paid || orderStatus?.is_failed) {
      return;
    }

    const interval = setInterval(() => {
      console.log('Auto-refreshing order status...');
      checkOrderStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [orderId, orderStatus?.is_paid, orderStatus?.is_failed]);

  // Create order and open payment gateway
  const createAndPay = async () => {
    try {
      setLoading(true);
      setOrderStatus(null);
      
      const amount = 100; // 100 EGP test amount

      // Create payment key
      const result = await paymobService.createRentalPaymentKey(
        'TEST_' + Date.now(),
        amount,
        'EGP',
        {
          firstName: 'Test',
          lastName: 'User',
          email: user?.email || 'test@example.com',
          phone: '+201234567890',
          apartment: 'NA',
          floor: 'NA',
          street: 'Test Street',
          building: 'NA',
          city: 'Cairo',
          country: 'EG',
          state: 'NA',
          postalCode: 'NA',
        }
      );

      setOrderId(result.orderId);
      console.log('Order created:', result.orderId);

      // Open payment gateway
      await openPaymentGateway(result.paymentKey);

      // Start checking status immediately
      setTimeout(() => checkOrderStatus(), 1000);
    } catch (error: any) {
      console.error('Payment flow failed:', error);
      showAlert('Error', `Payment failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Open Paymob Payment Gateway
  const openPaymentGateway = async (paymentKey: string) => {
    const iframeId = (process.env as any).EXPO_PUBLIC_PAYMOB_IFRAME_ID;
    
    if (!iframeId) {
      throw new Error('Paymob iframe ID not configured');
    }

    const paymobUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;
    
    console.log('Opening payment gateway...');
    
    const supported = await Linking.canOpenURL(paymobUrl);
    if (supported) {
      await Linking.openURL(paymobUrl);
    } else {
      throw new Error('Cannot open payment gateway URL');
    }
  };

  // Check order status
  const checkOrderStatus = async () => {
    if (!orderId || loadingStatus) {
      return;
    }

    try {
      setLoadingStatus(true);
      
      const authToken = await paymobService.authenticate();
      
      const response = await fetch(
        `https://accept.paymob.com/api/acceptance/transactions?order=${orderId}&token=${authToken}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch transaction status');
      }

      const data = await response.json();
      console.log('Raw API response:', JSON.stringify(data, null, 2));
      
      const transactions = data.results || (Array.isArray(data) ? data : []);
      console.log('Total transactions from API:', transactions.length);
      
      // Filter only transactions for this specific order
      const orderTransactions = transactions.filter((t: any) => {
        // Handle both object and primitive order field
        const txnOrderId = typeof t.order === 'object' ? t.order?.id : t.order;
        const matches = txnOrderId?.toString() === orderId.toString();
        if (matches) {
          console.log('Found matching transaction:', {
            txnId: t.id,
            order: txnOrderId,
            success: t.success,
            pending: t.pending
          });
        }
        return matches;
      });
      
      console.log(`Filtered transactions for order ${orderId}:`, orderTransactions.length);
      
      if (orderTransactions.length === 0) {
        console.log('âڑ ï¸ڈ No transactions found yet for order:', orderId);
        console.log('All transaction orders:', transactions.map((t: any) => ({ id: t.id, order: t.order })));
        setOrderStatus({
          id: orderId,
          is_paid: false,
          amount_cents: 10000,
          currency: 'EGP',
          transactions: []
        });
        return;
      }

      // Find successful transaction
      const successfulTxn = orderTransactions.find((t: any) => t.success && !t.pending);
      const isPaid = !!successfulTxn;
      
      // Check if all transactions failed
      const allFailed = orderTransactions.every((t: any) => !t.success && !t.pending);
      
      console.log('âœ… Order status updated:', {
        orderId,
        transactions: orderTransactions.length,
        isPaid,
        allFailed,
        successfulTxn: successfulTxn?.id,
        allTransactionStatuses: orderTransactions.map((t: any) => ({
          id: t.id,
          success: t.success,
          pending: t.pending
        }))
      });
      
      const orderData = {
        id: orderId,
        is_paid: isPaid,
        is_failed: allFailed,
        amount_cents: orderTransactions[0]?.amount_cents || 10000,
        currency: orderTransactions[0]?.currency || 'EGP',
        created_at: orderTransactions[0]?.created_at || new Date().toISOString(),
        transactions: orderTransactions
      };
      
      setOrderStatus(orderData);
    } catch (error: any) {
      console.error('Error checking status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Reset and create new order
  const resetAndStart = () => {
    setOrderId('');
    setOrderStatus(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Test</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {!orderId ? (
          // No order - show create button
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Test Paymob Payment</Text>
            <Text style={styles.emptyText}>
              Create a test order for 100 EGP and complete the payment in the browser
            </Text>
            
            <Button
              title="Create Order & Pay"
              onPress={createAndPay}
              loading={loading}
              disabled={loading}
              variant="primary"
              style={styles.createButton}
            />

            <View style={styles.testCardsBox}>
              <Text style={styles.testCardsTitle}>ًںژ´ Test Card (Sandbox)</Text>
              <Text style={styles.testCardsText}>
                Card: 4987654321098769{'\n'}
                Expiry: Any future date{'\n'}
                CVV: Any 3 digits
              </Text>
            </View>
          </View>
        ) : (
          // Order exists - show status
          <View style={styles.orderSection}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderTitle}>Order #{orderId}</Text>
              <TouchableOpacity onPress={resetAndStart}>
                <Text style={styles.newOrderButton}>New Order</Text>
              </TouchableOpacity>
            </View>

            {/* Status Card */}
            {orderStatus ? (
              <View style={[
                styles.statusCard,
                orderStatus.is_paid ? styles.statusPaid : orderStatus.is_failed ? styles.statusFailed : styles.statusPending
              ]}>
                <View style={styles.statusHeader}>
                  <Text style={[
                    styles.statusBadge,
                    orderStatus.is_paid ? styles.badgePaid : orderStatus.is_failed ? styles.badgeFailed : styles.badgePending
                  ]}>
                    {orderStatus.is_paid ? 'âœ… Paid' : orderStatus.is_failed ? 'â‌Œ Failed' : 'âڈ³ Pending'}
                  </Text>
                  {loadingStatus && (
                    <ActivityIndicator size="small" color="#4639eb" />
                  )}
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Amount:</Text>
                  <Text style={styles.statusValue}>
                    {orderStatus.amount_cents / 100} {orderStatus.currency}
                  </Text>
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Transactions:</Text>
                  <Text style={styles.statusValue}>
                    {orderStatus.transactions.length}
                  </Text>
                </View>

                {orderStatus.transactions.length > 0 && (
                  <View style={styles.transactionsList}>
                    <Text style={styles.transactionsTitle}>Transaction Details</Text>
                    {orderStatus.transactions.map((txn: any, index: number) => (
                      <View key={index} style={styles.transactionCard}>
                        <View style={styles.transactionRow}>
                          <Text style={styles.transactionLabel}>ID:</Text>
                          <Text style={styles.transactionValue}>#{txn.id}</Text>
                        </View>
                        <View style={styles.transactionRow}>
                          <Text style={styles.transactionLabel}>Status:</Text>
                          <Text style={[
                            styles.transactionStatus,
                            txn.success ? styles.txnSuccess : styles.txnPending
                          ]}>
                            {txn.success ? 'âœ“ Success' : txn.pending ? 'âڈ³ Pending' : 'âœ— Failed'}
                          </Text>
                        </View>
                        {txn.source_data && (
                          <View style={styles.transactionRow}>
                            <Text style={styles.transactionLabel}>Card:</Text>
                            <Text style={styles.transactionValue}>
                              {txn.source_data.type} â€¢â€¢â€¢â€¢ {txn.source_data.pan?.slice(-4)}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#4639eb" />
                <Text style={styles.loadingText}>Loading order status...</Text>
              </View>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#4639eb" />
              <Text style={styles.infoText}>
                {orderStatus?.is_paid 
                  ? 'Payment completed successfully!'
                  : orderStatus?.transactions.length > 0 && orderStatus.transactions.some((t: any) => !t.success)
                  ? 'Payment failed. Please try again with a valid test card (4987654321098769).'
                  : 'Status updates automatically every 2 seconds and when you return to this tab.'}
              </Text>
            </View>

            <Button
              title="ًں”„ Refresh Status"
              onPress={checkOrderStatus}
              loading={loadingStatus}
              disabled={loadingStatus}
              variant="outline"
              style={styles.refreshButton}
            />
          </View>
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
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    maxWidth: 300,
  },
  createButton: {
    minWidth: 200,
    marginBottom: 24,
  },
  testCardsBox: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    width: '100%',
    maxWidth: 400,
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
  orderSection: {
    width: '100%',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  newOrderButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4639eb',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  statusPaid: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  statusPending: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  statusFailed: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    fontSize: 18,
    fontWeight: '600',
  },
  badgePaid: {
    color: '#059669',
  },
  badgePending: {
    color: '#D97706',
  },
  badgeFailed: {
    color: '#DC2626',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  transactionsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  transactionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  transactionCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  transactionLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  transactionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  txnSuccess: {
    color: '#059669',
  },
  txnPending: {
    color: '#D97706',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 18,
  },
  refreshButton: {
    marginBottom: 16,
  },
});

export default PaymobTestScreen;


