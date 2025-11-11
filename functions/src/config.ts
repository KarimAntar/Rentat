import * as admin from 'firebase-admin';

// Firebase Admin SDK configuration for Cloud Functions
export const initializeFirebaseAdmin = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      // Firebase Admin SDK will automatically use the default credentials
      // when running in Cloud Functions environment
    });
  }
  return admin;
};

// Get Firestore instance
export const getFirestore = () => {
  const admin = initializeFirebaseAdmin();
  return admin.firestore();
};

// Get Auth instance
export const getAuth = () => {
  const admin = initializeFirebaseAdmin();
  return admin.auth();
};

// Get Storage instance
export const getStorage = () => {
  const admin = initializeFirebaseAdmin();
  return admin.storage();
};

// Collections configuration
export const collections = {
  users: 'users',
  items: 'items',
  rentals: 'rentals',
  chats: 'chats',
  notifications: 'notifications',
  walletTransactions: 'wallet_transactions',
  verifications: 'verifications',
} as const;

// Environment variables for functions
export const config = {
  paymob: {
    apiKey: (process.env as any).PAYMOB_API_KEY || '',
    integrationId: (process.env as any).PAYMOB_INTEGRATION_ID || '',
    hmacSecret: (process.env as any).PAYMOB_HMAC_SECRET || '',
  },
  // Deprecated Stripe config - kept for reference during migration
  stripe: {
    secretKey: (process.env as any).STRIPE_SECRET_KEY || '',
    webhookSecret: (process.env as any).STRIPE_WEBHOOK_SECRET || '',
  },
  didit: {
    apiKey: 'arUslI6-aKMrMXKtExrHRbJiz-M4c4UcG8qK_EiIV9w',
    workflowId: '09461199-947d-4606-99c1-fffa7fd91efc',
    webhookSecret: '8TZs7WgdreX9ByygbyXEfhOA25FPZsnm7f_jURLStKY',
  },
};
