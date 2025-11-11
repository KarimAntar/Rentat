/**
 * Didit KYC Service for Firebase Cloud Functions
 *
 * This service integrates with Didit's KYC verification API
 * to handle webhook events from Didit.
 *
 * This is separate from the frontend service to avoid config conflicts.
 */
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
export declare class DiditKycService {
    private static instance;
    private constructor();
    static getInstance(): DiditKycService;
    /**
     * Handle webhook payload from Didit
     */
    handleWebhook(payload: DiditWebhookPayload): Promise<void>;
    /**
     * Private helper methods
     */
    private updateUserKycStatus;
    private getUserIdBySessionId;
}
export declare const diditKycService: DiditKycService;
export default diditKycService;
