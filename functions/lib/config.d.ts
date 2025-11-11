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
        apiKey: any;
        integrationId: any;
        hmacSecret: any;
    };
    stripe: {
        secretKey: any;
        webhookSecret: any;
    };
    didit: {
        apiKey: string;
        workflowId: string;
        webhookSecret: string;
    };
};
