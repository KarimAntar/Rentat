import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Platform } from 'react-native';

// Stripe configuration
const STRIPE_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  apiVersion: '2023-10-16' as const,
  // Add additional configuration based on platform
  ...(Platform.OS === 'web' && {
    // Web-specific configuration
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#4639eb',
        colorBackground: '#FFFFFF',
        colorText: '#111827',
        colorDanger: '#EF4444',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
    },
  }),
};

// Validate required configuration
if (!STRIPE_CONFIG.publishableKey) {
  throw new Error('Missing required Stripe configuration: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
}

// Initialize Stripe
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_CONFIG.publishableKey!);
  }
  return stripePromise;
};

// Stripe service class for handling payments
export class StripeService {
  private static instance: StripeService;
  private stripe: Stripe | null = null;

  private constructor() {}

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  // Initialize Stripe instance
  public async initialize(): Promise<void> {
    if (!this.stripe) {
      this.stripe = await getStripe();
      if (!this.stripe) {
        throw new Error('Failed to initialize Stripe');
      }
    }
  }

  // Create payment intent for rental
  public async createRentalPaymentIntent(
    rentalId: string,
    amount: number,
    currency: string = 'usd'
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          metadata: {
            rentalId,
            type: 'rental_payment',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      return {
        clientSecret: data.client_secret,
        paymentIntentId: data.id,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  // Process payment with payment method
  public async confirmPayment(
    clientSecret: string,
    paymentMethodId: string,
    billingDetails?: {
      name?: string;
      email?: string;
      phone?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
    }
  ): Promise<{ paymentIntent: any; error?: any }> {
    await this.initialize();

    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethodId,
        ...(billingDetails && { billing_details: billingDetails }),
      });

      return {
        paymentIntent: result.paymentIntent,
        error: result.error,
      };
    } catch (error) {
      console.error('Error confirming payment:', error);
      return {
        paymentIntent: null,
        error: { message: 'Payment confirmation failed' },
      };
    }
  }

  // Create payment method
  public async createPaymentMethod(
    cardElement: any,
    billingDetails?: {
      name?: string;
      email?: string;
      phone?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
    }
  ): Promise<{ paymentMethod: any; error?: any }> {
    await this.initialize();

    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const result = await this.stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        ...(billingDetails && { billing_details: billingDetails }),
      });

      return {
        paymentMethod: result.paymentMethod,
        error: result.error,
      };
    } catch (error) {
      console.error('Error creating payment method:', error);
      return {
        paymentMethod: null,
        error: { message: 'Failed to create payment method' },
      };
    }
  }

  // Retrieve payment intent
  public async retrievePaymentIntent(
    clientSecret: string
  ): Promise<{ paymentIntent: any; error?: any }> {
    await this.initialize();

    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const result = await this.stripe.retrievePaymentIntent(clientSecret);

      return {
        paymentIntent: result.paymentIntent,
        error: result.error,
      };
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      return {
        paymentIntent: null,
        error: { message: 'Failed to retrieve payment intent' },
      };
    }
  }

  // Handle 3D Secure authentication
  public async handleCardAction(
    clientSecret: string
  ): Promise<{ paymentIntent: any; error?: any }> {
    await this.initialize();

    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const result = await this.stripe.handleCardAction(clientSecret);

      return {
        paymentIntent: result.paymentIntent,
        error: result.error,
      };
    } catch (error) {
      console.error('Error handling card action:', error);
      return {
        paymentIntent: null,
        error: { message: 'Failed to handle card action' },
      };
    }
  }

  // Create Setup Intent for saving payment methods
  public async createSetupIntent(
    customerId?: string
  ): Promise<{ clientSecret: string; setupIntentId: string }> {
    try {
      const response = await fetch('/api/create-setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create setup intent');
      }

      const data = await response.json();
      return {
        clientSecret: data.client_secret,
        setupIntentId: data.id,
      };
    } catch (error) {
      console.error('Error creating setup intent:', error);
      throw new Error('Failed to create setup intent');
    }
  }

  // Confirm setup intent
  public async confirmSetupIntent(
    clientSecret: string,
    paymentMethodId: string
  ): Promise<{ setupIntent: any; error?: any }> {
    await this.initialize();

    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    try {
      const result = await this.stripe.confirmCardSetup(clientSecret, {
        payment_method: paymentMethodId,
      });

      return {
        setupIntent: result.setupIntent,
        error: result.error,
      };
    } catch (error) {
      console.error('Error confirming setup intent:', error);
      return {
        setupIntent: null,
        error: { message: 'Failed to confirm setup intent' },
      };
    }
  }
}

// Export singleton instance
export const stripeService = StripeService.getInstance();

// Utility functions
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100); // Convert to cents
};

export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100; // Convert from cents
};

// Payment method validation
export const validateCardNumber = (cardNumber: string): boolean => {
  // Remove spaces and non-digit characters
  const cleaned = cardNumber.replace(/\D/g, '');
  
  // Check length
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
export const handleStripeError = (error: any): string => {
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
    'withdrawal_count_limit_exceeded': 'You have exceeded the balance or credit limit on your card.',
    'charge_exceeds_source_limit': 'The charge exceeds the maximum amount for your card.',
    'instant_payouts_unsupported': 'Your debit card does not support instant payouts.',
    'duplicate_transaction': 'A transaction with identical details was recently submitted.',
    'fraudulent': 'The payment has been declined as it appears to be fraudulent.',
    'generic_decline': 'Your card was declined. Please contact your bank for more information.',
    'invalid_account': 'The account number is invalid.',
    'lost_card': 'The payment has been declined because the card is reported lost.',
    'merchant_blacklist': 'The payment has been declined by your bank.',
    'new_account_information_available': 'Your card details have changed. Please update your payment method.',
    'no_action_taken': 'The requested action could not be performed.',
    'not_permitted': 'The payment is not permitted.',
    'pickup_card': 'Your card cannot be used to make this payment.',
    'restricted_card': 'Your card has restrictions on this type of purchase.',
    'revocation_of_all_authorizations': 'Your bank has declined the payment.',
    'revocation_of_authorization': 'Your bank has declined the payment.',
    'security_violation': 'Your bank has declined the payment due to security reasons.',
    'service_not_allowed': 'The payment has been declined by your bank.',
    'stolen_card': 'The payment has been declined because the card is reported stolen.',
    'test_mode_live_card': 'Your card cannot be used in test mode.',
    'transaction_not_allowed': 'The payment has been declined by your bank.',
    'try_again_later': 'Please try again later.',
  };
  
  return errorMessages[error.code] || error.message || 'An error occurred while processing your payment.';
};

export default stripeService;
