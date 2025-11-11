/**
 * Didit KYC Service
 * 
 * This service integrates with Didit's KYC verification API
 * to perform identity verification for users.
 * 
 * Documentation: https://docs.didit.me
 */

import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, collections } from '../config/firebase';

// Didit API Configuration
const DIDIT_API_BASE_URL = 'https://api.didit.me/v2';
const DIDIT_API_KEY = (process.env as any).REACT_APP_DIDIT_API_KEY || '';

export interface DiditSession {
  sessionId: string;
  verificationUrl: string;
  qrCode?: string;
  status: DiditVerificationStatus;
  workflowId: string;
  createdAt: Date;
  expiresAt: Date;
}

export type DiditVerificationStatus = 
  | 'not_started'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface DiditVerificationData {
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
}

export interface DiditWebhookPayload {
  event_type: 'status.updated' | 'data.updated';
  session_id: string;
  status: DiditVerificationStatus;
  workflow_id: string;
  data?: DiditVerificationData;
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
   * Create a new KYC verification session for a user
   */
  public async createVerificationSession(
    userId: string,
    workflowId?: string
  ): Promise<DiditSession> {
    try {
      // Call Firebase Functions endpoint instead of direct API
      const response = await fetch('https://webhooks-tfsivlyrrq-uc.a.run.app/create-kyc-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          workflowId,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create verification session';
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || error.details || errorMessage;
          console.error('Backend error details:', error);
        } catch (e) {
          // If we can't parse JSON, get text response
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
          console.error('Backend error text:', errorText);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      const session: DiditSession = {
        sessionId: data.sessionId,
        verificationUrl: data.verificationUrl,
        qrCode: data.qrCode,
        status: 'not_started',
        workflowId: workflowId || (process.env as any).REACT_APP_DIDIT_WORKFLOW_ID || 'default-kyc-workflow',
        createdAt: new Date(),
        expiresAt: new Date(data.expiresAt || Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      return session;
    } catch (error) {
      console.error('Error creating Didit verification session:', error);
      throw new Error('Failed to create KYC verification session');
    }
  }

  /**
   * Get the status of a verification session
   */
  public async getSessionStatus(sessionId: string): Promise<{
    status: DiditVerificationStatus;
    data?: DiditVerificationData;
  }> {
    try {
      const response = await fetch(`${DIDIT_API_BASE_URL}/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${DIDIT_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch session status');
      }

      const data = await response.json();
      
      return {
        status: data.status,
        data: data.kyc_data,
      };
    } catch (error) {
      console.error('Error fetching session status:', error);
      throw new Error('Failed to fetch verification status');
    }
  }

  /**
   * Handle webhook payload from Didit
   */
  public async handleWebhook(payload: DiditWebhookPayload): Promise<void> {
    try {
      const { session_id, status, data: kycData } = payload;

      // Find user by session ID
      const userId = await this.getUserIdBySessionId(session_id);
      
      if (!userId) {
        console.error('User not found for session:', session_id);
        return;
      }

      // Update user's KYC status
      await this.updateUserKycStatus(userId, status, kycData);

    } catch (error) {
      console.error('Error handling Didit webhook:', error);
      throw error;
    }
  }

  /**
   * Check if user has completed KYC verification
   */
  public async isUserKycVerified(userId: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, collections.users, userId));
      
      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data();
      return userData.diditKyc?.status === 'approved';
    } catch (error) {
      console.error('Error checking KYC status:', error);
      return false;
    }
  }

  /**
   * Get user's KYC status and data
   */
  public async getUserKycInfo(userId: string): Promise<{
    status: DiditVerificationStatus | null;
    sessionId?: string;
    verificationUrl?: string;
    data?: DiditVerificationData;
    lastUpdated?: Date;
  }> {
    try {
      const userDoc = await getDoc(doc(db, collections.users, userId));
      
      if (!userDoc.exists()) {
        return { status: null };
      }

      const userData = userDoc.data();
      const diditKyc = userData.diditKyc;

      if (!diditKyc) {
        return { status: null };
      }

      return {
        status: diditKyc.status,
        sessionId: diditKyc.sessionId,
        verificationUrl: diditKyc.verificationUrl,
        data: diditKyc.data,
        lastUpdated: diditKyc.lastUpdated?.toDate(),
      };
    } catch (error) {
      console.error('Error getting user KYC info:', error);
      return { status: null };
    }
  }

  /**
   * Require KYC verification for sensitive operations
   * Throws an error if user is not verified
   */
  public async requireKycVerification(userId: string): Promise<void> {
    const isVerified = await this.isUserKycVerified(userId);
    
    if (!isVerified) {
      const kycInfo = await this.getUserKycInfo(userId);
      
      if (!kycInfo.status || kycInfo.status === 'not_started') {
        throw new Error('KYC_REQUIRED');
      } else if (kycInfo.status === 'in_progress') {
        throw new Error('KYC_IN_PROGRESS');
      } else if (kycInfo.status === 'in_review') {
        throw new Error('KYC_IN_REVIEW');
      } else if (kycInfo.status === 'rejected') {
        throw new Error('KYC_REJECTED');
      } else if (kycInfo.status === 'expired') {
        throw new Error('KYC_EXPIRED');
      }
      
      throw new Error('KYC_VERIFICATION_FAILED');
    }
  }

  /**
   * Private helper methods
   */

  private async updateUserKycSession(
    userId: string,
    session: DiditSession
  ): Promise<void> {
    const userRef = doc(db, collections.users, userId);
    
    await updateDoc(userRef, {
      'diditKyc.sessionId': session.sessionId,
      'diditKyc.verificationUrl': session.verificationUrl,
      'diditKyc.qrCode': session.qrCode,
      'diditKyc.status': session.status,
      'diditKyc.workflowId': session.workflowId,
      'diditKyc.createdAt': serverTimestamp(),
      'diditKyc.expiresAt': session.expiresAt,
      'diditKyc.lastUpdated': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  private async updateUserKycStatus(
    userId: string,
    status: DiditVerificationStatus,
    kycData?: DiditVerificationData
  ): Promise<void> {
    const userRef = doc(db, collections.users, userId);
    
    const updates: any = {
      'diditKyc.status': status,
      'diditKyc.lastUpdated': serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (kycData) {
      updates['diditKyc.data'] = kycData;
    }

    if (status === 'approved') {
      updates['diditKyc.verifiedAt'] = serverTimestamp();
      // Also update the legacy verification field for backward compatibility
      updates['verification.isVerified'] = true;
      updates['verification.verificationStatus'] = 'approved';
      updates['verification.verifiedAt'] = serverTimestamp();
    }

    await updateDoc(userRef, updates);
  }

  private async getUserIdBySessionId(sessionId: string): Promise<string | null> {
    // In a production environment, you would query Firestore to find the user
    // with the matching session ID. For now, we'll extract it from the metadata
    // that we stored when creating the session.
    
    try {
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

  /**
   * Cancel a verification session
   */
  public async cancelSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${DIDIT_API_BASE_URL}/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${DIDIT_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel session');
      }
    } catch (error) {
      console.error('Error canceling session:', error);
      throw new Error('Failed to cancel verification session');
    }
  }

  /**
   * Get verification requirements/info for display to users
   */
  public getVerificationInfo(): {
    name: string;
    description: string;
    requirements: string[];
    estimatedTime: string;
    documents: string[];
  } {
    return {
      name: 'Identity Verification',
      description: 'Verify your identity to unlock withdrawals and rental requests. This helps keep our community safe and secure.',
      requirements: [
        'A valid government-issued ID (passport, driver\'s license, or national ID)',
        'A smartphone or computer with a camera',
        'Good lighting for clear photos',
        'A few minutes of your time',
      ],
      estimatedTime: '2-3 minutes',
      documents: [
        'Passport',
        'Driver\'s License',
        'National ID Card',
        'Residence Permit',
      ],
    };
  }
}

// Export singleton instance
export const diditKycService = DiditKycService.getInstance();

// Export convenience hook
export const useDiditKyc = () => {
  return {
    createVerificationSession: diditKycService.createVerificationSession.bind(diditKycService),
    getSessionStatus: diditKycService.getSessionStatus.bind(diditKycService),
    isUserKycVerified: diditKycService.isUserKycVerified.bind(diditKycService),
    getUserKycInfo: diditKycService.getUserKycInfo.bind(diditKycService),
    requireKycVerification: diditKycService.requireKycVerification.bind(diditKycService),
    cancelSession: diditKycService.cancelSession.bind(diditKycService),
    getVerificationInfo: diditKycService.getVerificationInfo.bind(diditKycService),
  };
};

export default diditKycService;
