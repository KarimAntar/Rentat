"use strict";
/**
 * Didit KYC Service for Firebase Cloud Functions
 *
 * This service integrates with Didit's KYC verification API
 * to handle webhook events from Didit.
 *
 * This is separate from the frontend service to avoid config conflicts.
 */
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
exports.diditKycService = exports.DiditKycService = void 0;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
// Didit API Configuration
const DIDIT_API_BASE_URL = 'https://api.didit.me/v2';
const DIDIT_API_KEY = config_1.config.didit.apiKey;
class DiditKycService {
    constructor() { }
    static getInstance() {
        if (!DiditKycService.instance) {
            DiditKycService.instance = new DiditKycService();
        }
        return DiditKycService.instance;
    }
    /**
     * Handle webhook payload from Didit
     */
    async handleWebhook(payload) {
        try {
            const { session_id, status, data: kycData } = payload;
            console.log(`Processing Didit webhook for session ${session_id}: ${status}`);
            // Find user by session ID
            const userId = await this.getUserIdBySessionId(session_id);
            if (!userId) {
                console.error('User not found for session:', session_id);
                return;
            }
            // Normalize status to lowercase (Didit sends capitalized statuses)
            const normalizedStatus = status.toLowerCase().replace(/ /g, '_');
            console.log(`Updating KYC status for user ${userId}: ${normalizedStatus}`);
            // Update user's KYC status
            await this.updateUserKycStatus(userId, normalizedStatus, kycData);
            console.log(`Successfully updated KYC status for user ${userId}`);
        }
        catch (error) {
            console.error('Error handling Didit webhook:', error);
            throw error;
        }
    }
    /**
     * Private helper methods
     */
    async updateUserKycStatus(userId, status, kycData) {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(userId);
        const updates = {
            'diditKyc.status': status,
            'diditKyc.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (kycData) {
            updates['diditKyc.data'] = kycData;
        }
        if (status === 'approved') {
            updates['diditKyc.verifiedAt'] = admin.firestore.FieldValue.serverTimestamp();
            // Also update the legacy verification field for backward compatibility
            updates['verification.isVerified'] = true;
            updates['verification.verificationStatus'] = 'approved';
            updates['verification.verifiedAt'] = admin.firestore.FieldValue.serverTimestamp();
        }
        await userRef.update(updates);
    }
    async getUserIdBySessionId(sessionId) {
        var _a;
        try {
            // Query users collection to find the one with this session ID
            const db = admin.firestore();
            const usersQuery = await db.collection('users')
                .where('diditKyc.sessionId', '==', sessionId)
                .limit(1)
                .get();
            if (!usersQuery.empty) {
                return usersQuery.docs[0].id;
            }
            // Fallback: try to get from Didit API
            const response = await fetch(`${DIDIT_API_BASE_URL}/session/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${DIDIT_API_KEY}`,
                },
            });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return data.external_id || ((_a = data.metadata) === null || _a === void 0 ? void 0 : _a.user_id) || null;
        }
        catch (error) {
            console.error('Error getting user ID from session:', error);
            return null;
        }
    }
}
exports.DiditKycService = DiditKycService;
// Export singleton instance
exports.diditKycService = DiditKycService.getInstance();
exports.default = exports.diditKycService;
//# sourceMappingURL=diditKyc.js.map