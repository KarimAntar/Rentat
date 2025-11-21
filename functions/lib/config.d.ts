import * as admin from 'firebase-admin';
export declare const initializeFirebaseAdmin: () => typeof admin;
export declare const getFirestore: () => admin.firestore.Firestore;
export declare const getAuth: () => import("firebase-admin/auth").Auth;
export declare const getStorage: () => import("firebase-admin/lib/storage/storage").Storage;
export declare const collections: {
    readonly users: "users";
    readonly items: "items";
    readonly rentals: "rentals";
    readonly chats: "chats";
    readonly notifications: "notifications";
    readonly walletTransactions: "wallet_transactions";
    readonly verifications: "verifications";
};
export declare const config: {
    paymob: {
        apiKey: string;
        integrationId: string;
        hmacSecret: string;
        secretKey: string;
    };
    stripe: {
        secretKey: string;
        webhookSecret: string;
    };
    didit: {
        apiKey: string;
        workflowId: string;
        webhookSecret: string;
        webhookUrl: string;
    };
    vapid: {
        privateKey: string;
        publicKey: string;
    };
};
