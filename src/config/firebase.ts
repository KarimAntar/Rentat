import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

console.log("FIREBASE_API_KEY at runtime:", process.env.EXPO_PUBLIC_FIREBASE_API_KEY);

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate required configuration
const requiredFields = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

for (const field of requiredFields) {
  if (!process.env[field]) {
    throw new Error(`Missing required Firebase configuration: ${field}`);
  }
}

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase Auth
let auth: Auth;
try {
  // For React Native, we'll use the default auth instance
  auth = getAuth(app);
} catch (error) {
  // If auth is already initialized, get the existing instance
  auth = getAuth(app);
}

// Initialize Firestore
const db: Firestore = getFirestore(app);

// Initialize Storage
const storage: FirebaseStorage = getStorage(app);

// Initialize Functions
const functions: Functions = getFunctions(app);

// Connect to emulators in development
if (__DEV__ && Constants.expoConfig?.extra?.useEmulators) {
  const emulatorHost = Constants.expoConfig.extra.emulatorHost || 'localhost';
  
  try {
    // Connect to Firestore emulator
    connectFirestoreEmulator(db, emulatorHost, 8080);
  } catch (error) {
    console.log('Firestore emulator already connected');
  }

  try {
    // Connect to Auth emulator
    // Note: Auth emulator connection is handled differently in newer versions
    console.log('Auth emulator should be configured in app.json/app.config.js');
  } catch (error) {
    console.log('Auth emulator connection error:', error);
  }

  try {
    // Connect to Storage emulator
    connectStorageEmulator(storage, emulatorHost, 9199);
  } catch (error) {
    console.log('Storage emulator already connected');
  }

  try {
    // Connect to Functions emulator
    connectFunctionsEmulator(functions, emulatorHost, 5001);
  } catch (error) {
    console.log('Functions emulator already connected');
  }
}

// Collection references for type safety
export const collections = {
  users: 'users',
  items: 'items',
  rentals: 'rentals',
  chats: 'chats',
  reviews: 'reviews',
  walletTransactions: 'wallet_transactions',
  notifications: 'notifications',
  categories: 'categories',
  adminLogs: 'admin_logs',
} as const;

// Export Firebase services
export { app, auth, db, storage, functions };

// Firebase configuration constants
export const FIREBASE_CONFIG = {
  // Storage paths
  STORAGE_PATHS: {
    USER_PROFILES: 'users/{userId}/profile.jpg',
    USER_VERIFICATION: 'users/{userId}/verification/',
    ITEM_IMAGES: 'items/{itemId}/',
    CHAT_IMAGES: 'chats/{chatId}/',
    REVIEW_IMAGES: 'reviews/{reviewId}/',
    PUBLIC_ASSETS: 'public/',
  },
  
  // File size limits (in bytes)
  FILE_SIZE_LIMITS: {
    PROFILE_IMAGE: 5 * 1024 * 1024, // 5MB
    ITEM_IMAGE: 10 * 1024 * 1024, // 10MB
    VERIFICATION_DOCUMENT: 10 * 1024 * 1024, // 10MB
    CHAT_IMAGE: 10 * 1024 * 1024, // 10MB
  },
  
  // Supported image formats
  SUPPORTED_IMAGE_FORMATS: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  
  // Pagination defaults
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  
  // Real-time listeners
  REALTIME_COLLECTIONS: [
    'chats',
    'notifications',
    'rentals',
  ],
} as const;

// Helper functions
export const getStoragePath = (template: string, params: Record<string, string>): string => {
  let path = template;
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(`{${key}}`, value);
  });
  return path;
};

export const validateImageFile = (file: { size: number; type: string }, maxSize: number): boolean => {
  if (file.size > maxSize) {
    throw new Error(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`);
  }
  
  if (!FIREBASE_CONFIG.SUPPORTED_IMAGE_FORMATS.includes(file.type as any)) {
    throw new Error('Unsupported file format. Please use JPEG, PNG, or WebP.');
  }
  
  return true;
};

// Error handling
export class FirebaseError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FirebaseError';
  }
}

export const handleFirebaseError = (error: any): FirebaseError => {
  console.error('Firebase Error:', error);
  
  // Map common Firebase error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters long.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'permission-denied': 'You do not have permission to perform this action.',
    'not-found': 'The requested resource was not found.',
    'already-exists': 'The resource already exists.',
    'resource-exhausted': 'Service quota exceeded. Please try again later.',
    'unauthenticated': 'Please sign in to continue.',
    'unavailable': 'Service is currently unavailable. Please try again later.',
  };
  
  const code = error.code || 'unknown';
  const message = errorMessages[code] || error.message || 'An unexpected error occurred.';
  
  return new FirebaseError(code, message, error);
};

// Initialize Firebase App Check for production
// TODO: Enable App Check in production when needed
// if (!__DEV__ && Constants.expoConfig?.extra?.enableAppCheck) {
//   const appCheckToken = process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_TOKEN;
//   if (appCheckToken) {
//     // Initialize App Check here when needed
//     console.log('App Check would be initialized here');
//   }
// }

export default app;
