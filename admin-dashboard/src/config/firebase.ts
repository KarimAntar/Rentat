import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Firebase configuration - uses same project as main app
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate required configuration
const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

for (const varName of requiredVars) {
  if (!import.meta.env[varName]) {
    throw new Error(`Missing required Firebase configuration: ${varName}`);
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Collection references
export const collections = {
  users: 'users',
  items: 'items',
  rentals: 'rentals',
  chats: 'chats',
  reviews: 'reviews',
  walletTransactions: 'wallet_transactions',
  notifications: 'notifications',
  categories: 'categories',
  // Admin-specific collections
  admins: 'admins',
  auditLogs: 'audit_logs',
  featureFlags: 'feature_flags',
  notificationCampaigns: 'notification_campaigns',
  disputes: 'disputes',
  moderationQueue: 'moderation_queue',
  systemLogs: 'system_logs',
} as const;

export default app;
