import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import Constants from 'expo-constants';

// Firebase configuration
// Fallback values provided for robustness if env vars fail to load
const firebaseConfig: any = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAVzDQ-j-V1lMYeqOtyhc3GcSEAnaNVgr8",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "rentat-app.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "rentat-app",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "rentat-app.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "124866170143",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:124866170143:web:4bc15004f9372d78a3742a",
};

// measurementId is optional
// @ts-ignore - Expo environment variables are available at runtime
const measurementId = process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-RWW5WL0LB0";
if (measurementId) {
  firebaseConfig.measurementId = measurementId;
}

// Validate required configuration
const requiredVars = [
  { key: "apiKey", value: firebaseConfig.apiKey },
  { key: "authDomain", value: firebaseConfig.authDomain },
  { key: "projectId", value: firebaseConfig.projectId },
  { key: "storageBucket", value: firebaseConfig.storageBucket },
  { key: "messagingSenderId", value: firebaseConfig.messagingSenderId },
  { key: "appId", value: firebaseConfig.appId },
];

for (const v of requiredVars) {
  if (!v.value) {
    console.error(`Missing required Firebase configuration: ${v.key}`);
    // We don't throw here to prevent immediate crash, but Firebase will likely fail to init
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

/**
 * Initialize Firestore with eur3 region for production.
 * This ensures the app connects to the correct Firestore instance.
 */
let db: Firestore;
try {
  db = initializeFirestore(app, { host: 'eur3-firestore.googleapis.com', ssl: true });
} catch (e) {
  // If already initialized, get instance
  db = getFirestore(app);
}

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
  favorites: 'favorites',
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

export default app;
