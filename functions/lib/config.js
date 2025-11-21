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
// Environment variables for functions using Firebase Functions environment variables
exports.config = {
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
//# sourceMappingURL=config.js.map