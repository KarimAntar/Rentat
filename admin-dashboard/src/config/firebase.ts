import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

 // Firebase configuration - uses same project as main app
 const firebaseConfig = {
   apiKey: process.env.VITE_FIREBASE_API_KEY,
   authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
   projectId: process.env.VITE_FIREBASE_PROJECT_ID,
   storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
   messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
   appId: process.env.VITE_FIREBASE_APP_ID,
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
  if (!process.env[varName]) {
    // In the dev/CI environment we may not have these set; allow runtime to handle actual missing vars.
    console.warn(`Firebase config env var not set at build-time: ${varName}`);
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
