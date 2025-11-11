"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.collections = exports.getStorage = exports.getAuth = exports.getFirestore = exports.initializeFirebaseAdmin = void 0;
const admin = __importStar(require("firebase-admin"));
// Firebase Admin SDK configuration for Cloud Functions
const initializeFirebaseAdmin = () => {
    if (!admin.apps.length) {
        admin.initializeApp({
        // Firebase Admin SDK will automatically use the default credentials
        // when running in Cloud Functions environment
        });
    }
    return admin;
};
exports.initializeFirebaseAdmin = initializeFirebaseAdmin;
// Get Firestore instance
const getFirestore = () => {
    const admin = (0, exports.initializeFirebaseAdmin)();
    return admin.firestore();
};
exports.getFirestore = getFirestore;
// Get Auth instance
const getAuth = () => {
    const admin = (0, exports.initializeFirebaseAdmin)();
    return admin.auth();
};
exports.getAuth = getAuth;
// Get Storage instance
const getStorage = () => {
    const admin = (0, exports.initializeFirebaseAdmin)();
    return admin.storage();
};
exports.getStorage = getStorage;
// Collections configuration
exports.collections = {
    users: 'users',
    items: 'items',
    rentals: 'rentals',
    chats: 'chats',
    notifications: 'notifications',
    walletTransactions: 'wallet_transactions',
    verifications: 'verifications',
};
// Environment variables for functions
exports.config = {
    paymob: {
        apiKey: process.env.PAYMOB_API_KEY || '',
        integrationId: process.env.PAYMOB_INTEGRATION_ID || '',
        hmacSecret: process.env.PAYMOB_HMAC_SECRET || '',
    },
    // Deprecated Stripe config - kept for reference during migration
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    didit: {
        apiKey: 'arUslI6-aKMrMXKtExrHRbJiz-M4c4UcG8qK_EiIV9w',
        workflowId: '09461199-947d-4606-99c1-fffa7fd91efc',
        webhookSecret: '8TZs7WgdreX9ByygbyXEfhOA25FPZsnm7f_jURLStKY',
        callbackUrl: 'https://rentat.vercel.app/kyc-callback',
    },
};
//# sourceMappingURL=config.js.map