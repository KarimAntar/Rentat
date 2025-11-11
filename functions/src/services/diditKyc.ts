/**
 * Didit KYC Service for Firebase Cloud Functions
 *
 * This service integrates with Didit's KYC verification API
 * to handle webhook events from Didit.
 *
 * This is separate from the frontend service to avoid config conflicts.
 */

import * as admin from 'firebase-admin';
import { config } from '../config';

// Didit API Configuration
const DIDIT_API_BASE_URL = 'https://api.didit.me/v2';
const DIDIT_API_KEY = config.didit.apiKey;

export interface DiditWebhookPayload {
  event_type: 'status.updated' | 'data.updated';
  session_id: string;
  status: 'not_started' | 'in_progress' | 'in_review' | 'approved' | 'rejected' | 'expired';
  workflow_id: string;
  data?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    documentNumber?: string;
    documentType?: string;
    documentExpiry?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  timestamp: string;
}

export class DiditKycService {
  private static instance: DiditKycService;

  private constructor() {}

  public static getInstance(): DiditKycService {
    if (!DiditKycService.instance) {
      DiditKycService.instance = new DiditKycService();
    }
    return DiditKycService.instance;
  }

  /**
   * Handle webhook payload from Didit
   */
  public async handleWebhook(payload: DiditWebhookPayload): Promise<void> {
    try {
      const { session_id, status, data: kycData } = payload;

      console.log(`Processing Didit webhook for session ${session_id}: ${status}`);

      // Find user by session ID
      const userId = await this.getUserIdBySessionId(session_id);

      if (!userId) {
        console.error('User not found for session:', session_id);
        return;
      }

      console.log(`Updating KYC status for user ${userId}: ${status}`);

      // Update user's KYC status
      await this.updateUserKycStatus(userId, status, kycData);

      console.log(`Successfully updated KYC status for user ${userId}`);

    } catch (error) {
      console.error('Error handling Didit webhook:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async updateUserKycStatus(
    userId: string,
    status: string,
    kycData?: any
  ): Promise<void> {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    const updates: any = {
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

  private async getUserIdBySessionId(sessionId: string): Promise<string | null> {
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
      return data.external_id || data.metadata?.user_id || null;
    } catch (error) {
      console.error('Error getting user ID from session:', error);
      return null;
    }
  }
}

// Export singleton instance
export const diditKycService = DiditKycService.getInstance();

export default diditKycService;
