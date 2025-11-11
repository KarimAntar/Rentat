import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
// Note: To use WebView, install: npm install react-native-webview
// For now, we'll open payment in external browser
import { Ionicons } from '@expo/vector-icons';
import { paymobService } from '../config/paymob';

interface PaymobPaymentProps {
  rentalId: string;
  amount: number;
  currency?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  onPaymentSuccess?: (transactionId: string) => void;
  onPaymentFailure?: (error: string) => void;
  onClose?: () => void;
}

const PaymobPayment: React.FC<PaymobPaymentProps> = ({
  rentalId,
  amount,
  currency = 'EGP',
  userEmail,
  userName,
  userPhone,
  onPaymentSuccess,
  onPaymentFailure,
  onClose,
}) => {
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create Paymob payment key
      const { paymentKey, orderId } = await paymobService.createRentalPaymentKey(
        rentalId,
        amount,
        currency,
        {
          firstName: userName?.split(' ')[0] || 'Guest',
          lastName: userName?.split(' ').slice(1).join(' ') || 'User',
          email: userEmail || 'customer@example.com',
          phone: userPhone || '+201234567890',
          city: 'Cairo',
          country: 'EG',
        }
      );

      // Generate Paymob iFrame URL
      const iframeId = (process.env as any).EXPO_PUBLIC_PAYMOB_IFRAME_ID;
      const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;
      setPaymentUrl(iframeUrl);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
      setError(errorMessage);
      onPaymentFailure?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentPage = async () => {
    if (!paymentUrl) return;

    try {
      await Linking.openURL(paymentUrl);
      // Note: In a real implementation, you'd need to handle the return from external browser
      // This could be done with deep linking or by checking payment status via API
    } catch (error) {
      Alert.alert('Error', 'Could not open payment page');
    }
  };

  // Note: Transaction handling would be done via webhooks in Firebase Functions
  // or by polling the Paymob API for transaction status

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Processing Payment</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.center}>
          <Text style={styles.loadingText}>Initializing payment...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Error</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={initializePayment}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!paymentUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Payment URL not available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.center}>
        <Ionicons name="card" size={48} color="#4639eb" />
        <Text style={styles.paymentTitle}>Ready to Pay</Text>
        <Text style={styles.paymentDescription}>
          Click below to complete your payment securely with Paymob
        </Text>

        <TouchableOpacity style={styles.payButton} onPress={openPaymentPage}>
          <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
          <Text style={styles.payButtonText}>Pay {amount} {currency}</Text>
        </TouchableOpacity>

        <Text style={styles.noteText}>
          You will be redirected to Paymob's secure payment page
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Amount: {amount} {currency}
        </Text>
        <Text style={styles.footerSubtext}>
          Complete your payment securely with Paymob
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4639eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  paymentDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4639eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default PaymobPayment;
