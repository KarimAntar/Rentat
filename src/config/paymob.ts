import { Platform } from 'react-native';

// Paymob configuration
const PAYMOB_CONFIG = {
  apiKey: (process.env as any).EXPO_PUBLIC_PAYMOB_API_KEY,
  publicKey: (process.env as any).EXPO_PUBLIC_PAYMOB_PUBLIC_KEY,
  secretKey: (process.env as any).EXPO_PUBLIC_PAYMOB_SECRET_KEY,
  integrationId: (process.env as any).EXPO_PUBLIC_PAYMOB_INTEGRATION_ID,
  iframeId: (process.env as any).EXPO_PUBLIC_PAYMOB_IFRAME_ID,
  hmacSecret: (process.env as any).EXPO_PUBLIC_PAYMOB_HMAC_SECRET,
  baseUrl: 'https://accept.paymob.com/api',
  currency: 'EGP', // Default currency for Egypt
};

// Validate required configuration
if (!PAYMOB_CONFIG.apiKey) {
  throw new Error('Missing required Paymob configuration: EXPO_PUBLIC_PAYMOB_API_KEY');
}

// Paymob service class for handling payments
export class PaymobService {
  private static instance: PaymobService;
  private authToken: string | null = null;
  private tokenExpiry: number | null = null;

  private constructor() {}

  public static getInstance(): PaymobService {
    if (!PaymobService.instance) {
      PaymobService.instance = new PaymobService();
    }
    return PaymobService.instance;
  }

  // Authenticate with Paymob and get auth token
  public async authenticate(): Promise<string> {
    try {
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.authToken;
      }

      const response = await fetch(`${PAYMOB_CONFIG.baseUrl}/auth/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: PAYMOB_CONFIG.apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to authenticate with Paymob');
      }

      const data = await response.json();
      this.authToken = data.token;
      // Token expires in 1 hour, set expiry to 55 minutes for safety
      this.tokenExpiry = Date.now() + 55 * 60 * 1000;

      return this.authToken!;
    } catch (error) {
      console.error('Error authenticating with Paymob:', error);
      throw new Error('Failed to authenticate with Paymob');
    }
  }

  // Create order (Paymob's equivalent of payment intent)
  public async createOrder(
    amount: number,
    currency: string = PAYMOB_CONFIG.currency
  ): Promise<{ orderId: string }> {
    try {
      const authToken = await this.authenticate();

      const response = await fetch(`${PAYMOB_CONFIG.baseUrl}/ecommerce/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          delivery_needed: 'false',
          amount_cents: Math.round(amount * 100), // Convert to cents
          currency: currency,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const data = await response.json();
      return { orderId: data.id.toString() };
    } catch (error) {
      console.error('Error creating order:', error);
      throw new Error('Failed to create order');
    }
  }

  // Create payment key for rental
  public async createRentalPaymentKey(
    rentalId: string,
    amount: number,
    currency: string = PAYMOB_CONFIG.currency,
    billingData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      apartment?: string;
      floor?: string;
      street?: string;
      building?: string;
      city?: string;
      country?: string;
      state?: string;
      postalCode?: string;
    } = {}
  ): Promise<{ paymentKey: string; orderId: string }> {
    try {
      const authToken = await this.authenticate();

      // Step 1: Create order
      const orderResponse = await fetch(`${PAYMOB_CONFIG.baseUrl}/ecommerce/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          delivery_needed: 'false',
          amount_cents: Math.round(amount * 100),
          currency: currency,
          merchant_order_id: rentalId,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const orderData = await orderResponse.json();
      const orderId = orderData.id;

      // Step 2: Create payment key
      const paymentKeyResponse = await fetch(`${PAYMOB_CONFIG.baseUrl}/acceptance/payment_keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          amount_cents: Math.round(amount * 100),
          expiration: 3600, // 1 hour expiration
          order_id: orderId,
          billing_data: {
            apartment: billingData.apartment || 'NA',
            email: billingData.email || 'customer@example.com',
            floor: billingData.floor || 'NA',
            first_name: billingData.firstName || 'Guest',
            street: billingData.street || 'NA',
            building: billingData.building || 'NA',
            phone_number: billingData.phone || '+201000000000',
            shipping_method: 'NA',
            postal_code: billingData.postalCode || 'NA',
            city: billingData.city || 'Cairo',
            country: billingData.country || 'EG',
            last_name: billingData.lastName || 'User',
            state: billingData.state || 'NA',
          },
          currency: currency,
          integration_id: parseInt(PAYMOB_CONFIG.integrationId || '0'),
        }),
      });

      if (!paymentKeyResponse.ok) {
        throw new Error('Failed to create payment key');
      }

      const paymentKeyData = await paymentKeyResponse.json();
      return {
        paymentKey: paymentKeyData.token,
        orderId: orderId.toString(),
      };
    } catch (error) {
      console.error('Error creating rental payment key:', error);
      throw new Error('Failed to create rental payment key');
    }
  }

  // Process payment with payment key
  public async processPayment(
    paymentKey: string,
    cardData?: {
      cardNumber: string;
      cardholderName: string;
      expiryMonth: string;
      expiryYear: string;
      cvv: string;
    }
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // For iframe integration, this would be handled on the client side
      // For API integration, we would send card data here
      if (cardData) {
        // This is a simplified version - actual implementation would depend on integration method
        console.warn('Direct card processing not recommended - use Paymob iFrame');
      }

      return {
        success: true,
        transactionId: 'pending',
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        error: 'Payment processing failed',
      };
    }
  }

  // Retrieve transaction details
  public async retrieveTransaction(
    transactionId: string
  ): Promise<{ transaction: any; error?: any }> {
    try {
      const authToken = await this.authenticate();

      const response = await fetch(
        `${PAYMOB_CONFIG.baseUrl}/acceptance/transactions/${transactionId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to retrieve transaction');
      }

      const data = await response.json();
      return { transaction: data };
    } catch (error) {
      console.error('Error retrieving transaction:', error);
      return {
        transaction: null,
        error: { message: 'Failed to retrieve transaction' },
      };
    }
  }

  // Refund transaction
  public async refundTransaction(
    transactionId: string,
    amount?: number
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const authToken = await this.authenticate();

      const response = await fetch(`${PAYMOB_CONFIG.baseUrl}/acceptance/void_refund/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          transaction_id: transactionId,
          amount_cents: amount ? Math.round(amount * 100) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refund transaction');
      }

      const data = await response.json();
      return {
        success: true,
        refundId: data.id?.toString(),
      };
    } catch (error) {
      console.error('Error refunding transaction:', error);
      return {
        success: false,
        error: 'Refund failed',
      };
    }
  }

  // Void transaction
  public async voidTransaction(
    transactionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const authToken = await this.authenticate();

      const response = await fetch(`${PAYMOB_CONFIG.baseUrl}/acceptance/void_refund/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          transaction_id: transactionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to void transaction');
      }

      return { success: true };
    } catch (error) {
      console.error('Error voiding transaction:', error);
      return {
        success: false,
        error: 'Void failed',
      };
    }
  }

  // Capture authorized transaction
  public async captureTransaction(
    transactionId: string,
    amount?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const authToken = await this.authenticate();

      const response = await fetch(`${PAYMOB_CONFIG.baseUrl}/acceptance/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_token: authToken,
          transaction_id: transactionId,
          amount_cents: amount ? Math.round(amount * 100) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to capture transaction');
      }

      return { success: true };
    } catch (error) {
      console.error('Error capturing transaction:', error);
      return {
        success: false,
        error: 'Capture failed',
      };
    }
  }

  // Verify HMAC for webhook
  public verifyHMAC(data: any, receivedHMAC: string): boolean {
    try {
      if (!PAYMOB_CONFIG.hmacSecret) {
        console.warn('HMAC secret not configured');
        return false;
      }

      const crypto = require('crypto');
      
      // Concatenate specific fields in Paymob's order
      const concatenatedString = [
        data.amount_cents,
        data.created_at,
        data.currency,
        data.error_occured,
        data.has_parent_transaction,
        data.id,
        data.integration_id,
        data.is_3d_secure,
        data.is_auth,
        data.is_capture,
        data.is_refunded,
        data.is_standalone_payment,
        data.is_voided,
        data.order?.id,
        data.owner,
        data.pending,
        data.source_data?.pan,
        data.source_data?.sub_type,
        data.source_data?.type,
        data.success,
      ]
        .filter((val) => val !== undefined && val !== null)
        .join('');

      const calculatedHMAC = crypto
        .createHmac('sha512', PAYMOB_CONFIG.hmacSecret)
        .update(concatenatedString)
        .digest('hex');

      return calculatedHMAC === receivedHMAC;
    } catch (error) {
      console.error('Error verifying HMAC:', error);
      return false;
    }
  }
}

// Export singleton instance
export const paymobService = PaymobService.getInstance();

// Utility functions
export const formatCurrency = (
  amount: number,
  currency: string = 'EGP',
  locale: string = 'ar-EG'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatAmountForPaymob = (amount: number): number => {
  return Math.round(amount * 100); // Convert to cents
};

export const formatAmountFromPaymob = (amount: number): number => {
  return amount / 100; // Convert from cents
};

// Payment method validation (reusing from Stripe)
export const validateCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\D/g, '');
  
  if (cleaned.length < 13 || cleaned.length > 19) {
    return false;
  }
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i));
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

export const validateExpiryDate = (expiry: string): boolean => {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  
  const month = parseInt(match[1]);
  const year = 2000 + parseInt(match[2]);
  
  if (month < 1 || month > 12) return false;
  
  const now = new Date();
  const expiryDate = new Date(year, month - 1);
  
  return expiryDate >= now;
};

export const validateCVC = (cvc: string): boolean => {
  return /^\d{3,4}$/.test(cvc);
};

// Card brand detection
export const getCardBrand = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\D/g, '');
  
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  if (/^(?:2131|1800|35\d{3})\d{11}$/.test(cleaned)) return 'jcb';
  if (/^3(?:0[0-5]|[68])/.test(cleaned)) return 'diners';
  
  return 'unknown';
};

// Error handling
export const handlePaymobError = (error: any): string => {
  if (!error) return 'An unknown error occurred';
  
  const errorMessages: Record<string, string> = {
    'card_declined': 'Your card was declined. Please try a different payment method.',
    'expired_card': 'Your card has expired. Please use a different card.',
    'incorrect_cvc': 'The security code is incorrect. Please check and try again.',
    'processing_error': 'An error occurred while processing your card. Please try again.',
    'incorrect_number': 'The card number is incorrect. Please check and try again.',
    'invalid_expiry_month': 'The expiration month is invalid.',
    'invalid_expiry_year': 'The expiration year is invalid.',
    'invalid_cvc': 'The security code is invalid.',
    'insufficient_funds': 'Your card has insufficient funds.',
    'authentication_failed': 'Card authentication failed. Please try again.',
    'timeout': 'Transaction timed out. Please try again.',
  };
  
  return errorMessages[error.code] || error.message || 'An error occurred while processing your payment.';
};

export default paymobService;
