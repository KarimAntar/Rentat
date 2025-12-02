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
exports.holdDepositFunction = exports.releasePartialDepositFunction = exports.releaseDepositFunction = void 0;
exports.validateDepositOperations = validateDepositOperations;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Callable function to release full deposit (admin only)
 */
exports.releaseDepositFunction = functions.https.onCall(async (request) => {
    var _a;
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user has admin custom claim
    const userRecord = await admin.auth().getUser(auth.uid);
    if (!((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'User must be an admin');
    }
    const { depositId, reason } = data;
    if (!depositId || !reason) {
        throw new functions.https.HttpsError('invalid-argument', 'depositId and reason are required');
    }
    try {
        const depositRef = db.collection('deposits').doc(depositId);
        const depositSnap = await depositRef.get();
        if (!depositSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Deposit not found');
        }
        const deposit = depositSnap.data();
        if ((deposit === null || deposit === void 0 ? void 0 : deposit.status) !== 'held') {
            throw new functions.https.HttpsError('failed-precondition', 'Can only release deposits that are currently held');
        }
        // Update deposit status
        await depositRef.update({
            status: 'released',
            releaseReason: reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Create wallet transaction
        await createDepositTransaction(deposit.userId, deposit.amount, 'deposit_release', depositId);
        // Send notification to user
        await notifyUserAboutDeposit(deposit.userId, 'released', deposit.amount, reason);
        return { success: true, message: 'Deposit released successfully' };
    }
    catch (error) {
        console.error('Error releasing deposit:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to release deposit');
    }
});
/**
 * Callable function to release partial deposit (admin only)
 */
exports.releasePartialDepositFunction = functions.https.onCall(async (request) => {
    var _a;
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userRecord = await admin.auth().getUser(auth.uid);
    if (!((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'User must be an admin');
    }
    const { depositId, partialAmount, reason } = data;
    if (!depositId || !partialAmount || !reason) {
        throw new functions.https.HttpsError('invalid-argument', 'depositId, partialAmount, and reason are required');
    }
    try {
        const depositRef = db.collection('deposits').doc(depositId);
        const depositSnap = await depositRef.get();
        if (!depositSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Deposit not found');
        }
        const deposit = depositSnap.data();
        if ((deposit === null || deposit === void 0 ? void 0 : deposit.status) !== 'held') {
            throw new functions.https.HttpsError('failed-precondition', 'Can only release deposits that are currently held');
        }
        if (partialAmount > deposit.amount) {
            throw new functions.https.HttpsError('invalid-argument', 'Partial amount cannot exceed total deposit amount');
        }
        // Update deposit status
        await depositRef.update({
            status: 'partial_refund',
            partialAmount,
            releaseReason: reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Create wallet transaction for partial release
        await createDepositTransaction(deposit.userId, partialAmount, 'deposit_refund', depositId);
        // Send notification to user
        await notifyUserAboutDeposit(deposit.userId, 'partial_refund', partialAmount, reason);
        return { success: true, message: 'Partial deposit released successfully' };
    }
    catch (error) {
        console.error('Error releasing partial deposit:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to release partial deposit');
    }
});
/**
 * Callable function to hold deposit (admin only)
 */
exports.holdDepositFunction = functions.https.onCall(async (request) => {
    var _a;
    const { auth, data } = request;
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userRecord = await admin.auth().getUser(auth.uid);
    if (!((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'User must be an admin');
    }
    const { depositId, reason } = data;
    if (!depositId || !reason) {
        throw new functions.https.HttpsError('invalid-argument', 'depositId and reason are required');
    }
    try {
        const depositRef = db.collection('deposits').doc(depositId);
        const depositSnap = await depositRef.get();
        if (!depositSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Deposit not found');
        }
        const deposit = depositSnap.data();
        await depositRef.update({
            status: 'held',
            holdReason: reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Send notification to user
        await notifyUserAboutDeposit(deposit.userId, 'held', deposit.amount, reason);
        return { success: true, message: 'Deposit held successfully' };
    }
    catch (error) {
        console.error('Error holding deposit:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to hold deposit');
    }
});
/**
 * Helper function to create wallet transaction
 */
async function createDepositTransaction(userId, amount, type, depositId) {
    try {
        const transactionsRef = db.collection('wallet_transactions');
        const transactionData = {
            userId,
            type,
            amount,
            currency: 'EGP',
            status: 'completed',
            availabilityStatus: 'AVAILABLE',
            payment: {
                description: type === 'deposit_release' ? 'Security deposit released' : 'Partial deposit refund',
            },
            metadata: {
                netAmount: amount,
                depositId,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await transactionsRef.add(transactionData);
        // Update user wallet balance
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            'wallet.balance': admin.firestore.FieldValue.increment(amount),
        });
    }
    catch (error) {
        console.error('Error creating deposit transaction:', error);
        throw error;
    }
}
/**
 * Helper function to notify user about deposit action
 */
async function notifyUserAboutDeposit(userId, status, amount, reason) {
    try {
        const notificationsRef = db.collection('dashboard_notifications');
        let title = '';
        let message = '';
        switch (status) {
            case 'released':
                title = 'Deposit Released';
                message = `Your security deposit of ${amount.toFixed(2)} EGP has been released. ${reason}`;
                break;
            case 'partial_refund':
                title = 'Partial Deposit Refund';
                message = `A partial refund of ${amount.toFixed(2)} EGP from your security deposit has been processed. ${reason}`;
                break;
            case 'held':
                title = 'Deposit Held';
                message = `Your security deposit of ${amount.toFixed(2)} EGP is being held. ${reason}`;
                break;
            default:
                title = 'Deposit Update';
                message = `Your security deposit status has been updated.`;
        }
        await notificationsRef.add({
            userId,
            title,
            message,
            type: 'deposit',
            read: false,
            data: {
                amount,
                status,
                reason,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Also create a regular notification for push notifications
        const regularNotificationsRef = db.collection('notifications');
        await regularNotificationsRef.add({
            userId,
            type: 'payment',
            title,
            body: message,
            status: 'unread',
            priority: 'normal',
            delivery: {
                push: {
                    sent: false,
                },
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error('Error notifying user about deposit:', error);
        // Don't throw error - notification failure shouldn't block the main operation
    }
}
/**
 * Validate deposit operations middleware
 */
function validateDepositOperations(depositData) {
    if (!depositData) {
        throw new Error('Deposit data is required');
    }
    if (!depositData.userId || !depositData.amount || !depositData.currency) {
        throw new Error('Invalid deposit data: missing required fields');
    }
    if (depositData.amount <= 0) {
        throw new Error('Deposit amount must be greater than 0');
    }
    return true;
}
//# sourceMappingURL=depositManagement.js.map