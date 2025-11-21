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

// Environment variables for functions using Firebase Functions environment variables
export const config = {
  paymob: {
    apiKey: process.env.PAYMOB_API_KEY || 'ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SmpiR0Z6Y3lJNklrMWxjbU5vWVc1MElpd2ljSEp2Wm1sc1pWOXdheUk2TVRBNU5qVTFOaXdpYm1GdFpTSTZJbWx1YVhScFlXd2lmUS5xbTZsd2RYdDhRRjZaY2pfRHhJWWlDbXd0alZzcjNjOW5ZOTEzdTJGVWZ2TnJ1NDA4YWNzclhnRm5nX0ZrUlNfM0Z1VFhtaHJ0YTM3QmFldExWZXFqQQ==',
    integrationId: process.env.PAYMOB_INTEGRATION_ID || '5369141',
    hmacSecret: process.env.PAYMOB_HMAC_SECRET || 'CCABDAA0D728DD9BDDC0C37A2F0584CF',
    secretKey: process.env.PAYMOB_SECRET_KEY || 'egy_sk_test_f4544ea67865154cbc1be5f17a257bd53c768d429b768064fcef03e667ae5777',
  },
  // Deprecated Stripe config - kept for reference during migration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  didit: {
    apiKey: process.env.DIDIT_API_KEY || '',
    workflowId: process.env.DIDIT_WORKFLOW_ID || '',
    webhookSecret: process.env.DIDIT_WEBHOOK_SECRET || '',
    webhookUrl: process.env.DIDIT_WEBHOOK_URL || '',
  },
  vapid: {
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    publicKey: 'BNpXrmVCfvQX3dzGCISIdhK9MpyMXJvCtg78HBuPTMr0pGYwf_bhclLruhCyPhVavkMUXgfRuT25ElvL5Au4CsA',
  },
};
