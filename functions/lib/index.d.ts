export declare const confirmHandoverOwner: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    bothConfirmed: boolean;
    message: string;
    error?: undefined;
    code?: undefined;
} | {
    success: boolean;
    bothConfirmed: boolean;
    message: string;
    error: any;
    code: any;
}>, unknown>;
export declare const webhooks: import("firebase-functions/v2/https").HttpsFunction;
export declare const processRentalRequest: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    rentalId: string;
    chatId: string;
    pricing: {
        dailyRate: any;
        totalDays: number;
        subtotal: number;
        platformFee: number;
        securityDeposit: any;
        deliveryFee: any;
        total: any;
        currency: string;
    };
}>, unknown>;
export declare const processRentalResponse: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    paymentClientSecret: any;
}>, unknown>;
export declare const completeRental: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export declare const onRentalCreated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    rentalId: string;
}>>;
export declare const onRentalUpdated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    rentalId: string;
}>>;
export declare const onNotificationCampaignCreated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    campaignId: string;
}>>;
export declare const onNotificationCampaignUpdated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    campaignId: string;
}>>;
export declare const checkScheduledCampaigns: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    processed: number;
}>, unknown>;
export declare const onMessageCreated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    chatId: string;
    messageId: string;
}>>;
export declare const confirmItemReceived: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export declare const confirmItemReturned: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export declare const refreshPaymentKey: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    paymentKey: string;
    orderId: number;
}>, unknown>;
export declare const requestPayout: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    payoutRequestId: string;
    estimatedProcessingTime: string;
}>, unknown>;
export declare const markAllNotificationsRead: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    updated: number;
}>, unknown>;
export declare const confirmHandoverRenter: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    bothConfirmed: boolean;
    message: string;
}>, unknown>;
export declare const testFunction: import("firebase-functions/v2/https").CallableFunction<any, Promise<"OK" | {
    success: boolean;
    message: string;
    timestamp: number;
    inputLength: number;
}>, unknown>;
export declare const createDispute: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    disputeId: string;
    message: string;
}>, unknown>;
export declare const resolveDisputeFunction: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
}>, unknown>;
export declare const getWalletBalanceFunction: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    available: number;
    pending: number;
    locked: number;
    total: number;
    currency: string;
}>, unknown>;
export declare const releaseDeposit: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const releasePartialDeposit: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare const holdDepositFunctionExport: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
