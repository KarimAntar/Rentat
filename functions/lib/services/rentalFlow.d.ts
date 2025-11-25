/**
 * Rental Flow Service
 * Implements the complete rent payment flow state machine including:
 * - Handover confirmation (dual confirmation)
 * - Dispute management
 * - Enhanced wallet logic with PENDING/LOCKED/AVAILABLE states
 */
/**
 * Phase 3: Handover State Machine
 * Renter confirms they have received the item from the owner
 */
export declare function confirmHandoverByRenter(rentalId: string, userId: string): Promise<{
    success: boolean;
    bothConfirmed: boolean;
}>;
/**
 * Phase 3: Handover State Machine
 * Owner confirms they have handed over the item to the renter
 */
export declare function confirmHandoverByOwner(rentalId: string, userId: string): Promise<{
    success: boolean;
    bothConfirmed: boolean;
}>;
/**
 * Phase 4: Dispute Management
 * Raise a dispute about a rental (can be called by owner or renter)
 */
export declare function raiseDispute(rentalId: string, userId: string, reason: string, evidence: string[]): Promise<{
    success: boolean;
    disputeId: string;
    message: string;
}>;
/**
 * Phase 4: Dispute Management
 * Resolve a dispute (moderator/admin only)
 */
export declare function resolveDispute(rentalId: string, moderatorId: string, decision: string, refundAmount: number, ownerCompensation: number): Promise<{
    success: boolean;
}>;
/**
 * Phase 5: Wallet & Payouts
 * Get wallet balance with proper separation of Available vs Pending/Locked funds
 * Only includes POSITIVE amounts (credits/income) - excludes negative amounts (expenses/payments)
 */
export declare function getWalletBalance(userId: string): Promise<{
    available: number;
    pending: number;
    locked: number;
    total: number;
    currency: string;
}>;
/**
 * Phase 2: Store Paymob transaction for audit trail
 */
export declare function storePaymobTransaction(rentalId: string, paymobOrderId: number, paymobTransactionId: string, amount: number, currency: string, status: 'pending' | 'success' | 'failed', hmac: string | undefined, rawPayload: any): Promise<void>;
/**
 * Helper: Update wallet transaction availability status
 */
export declare function updateTransactionAvailability(transactionId: string, newStatus: 'PENDING' | 'LOCKED' | 'AVAILABLE'): Promise<void>;
