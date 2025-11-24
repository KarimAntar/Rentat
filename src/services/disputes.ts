/**
 * Disputes Service
 * Manages dispute creation and resolution for rentals
 */

import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export interface DisputeEvidence {
  type: 'image' | 'video' | 'document';
  url: string;
  description?: string;
}

export interface RaiseDisputeParams {
  rentalId: string;
  reason: string;
  evidence: string[];
}

export interface RaiseDisputeResult {
  success: boolean;
  message: string;
  disputeId?: string;
}

export interface ResolveDisputeParams {
  rentalId: string;
  decision: 'favor_renter' | 'favor_owner' | 'split';
  refundAmount: number;
  ownerCompensation: number;
}

export interface ResolveDisputeResult {
  success: boolean;
  message: string;
}

export interface DisputeStatus {
  status: 'open' | 'under_review' | 'resolved';
  raisedBy: string;
  raisedAt: Date;
  reason: string;
  evidence: string[];
  resolution?: {
    decision: 'favor_renter' | 'favor_owner' | 'split';
    resolvedBy: string;
    resolvedAt: Date;
    refundAmount: number;
    ownerCompensation: number;
    notes?: string;
  };
}

/**
 * Raise a dispute for a rental
 */
export const raiseDispute = async (
  params: RaiseDisputeParams
): Promise<RaiseDisputeResult> => {
  try {
    const createDispute = httpsCallable<
      RaiseDisputeParams,
      RaiseDisputeResult
    >(functions, 'createDispute');

    const result = await createDispute(params);
    return result.data;
  } catch (error) {
    console.error('Error raising dispute:', error);
    throw error;
  }
};

/**
 * Resolve a dispute (admin/moderator only)
 */
export const resolveDispute = async (
  params: ResolveDisputeParams
): Promise<ResolveDisputeResult> => {
  try {
    const resolve = httpsCallable<
      ResolveDisputeParams,
      ResolveDisputeResult
    >(functions, 'resolveDisputeFunction');

    const result = await resolve(params);
    return result.data;
  } catch (error) {
    console.error('Error resolving dispute:', error);
    throw error;
  }
};

/**
 * Get dispute status from rental object
 */
export const getDisputeStatus = (rental: any): DisputeStatus | null => {
  if (!rental.dispute) {
    return null;
  }

  const dispute = rental.dispute;

  return {
    status: dispute.status,
    raisedBy: dispute.raisedBy,
    raisedAt: dispute.raisedAt?.toDate(),
    reason: dispute.reason,
    evidence: dispute.evidence || [],
    resolution: dispute.resolution
      ? {
          decision: dispute.resolution.decision,
          resolvedBy: dispute.resolution.resolvedBy,
          resolvedAt: dispute.resolution.resolvedAt?.toDate(),
          refundAmount: dispute.resolution.refundAmount,
          ownerCompensation: dispute.resolution.ownerCompensation,
          notes: dispute.resolution.notes,
        }
      : undefined,
  };
};

/**
 * Check if user can raise a dispute
 */
export const canRaiseDispute = (
  rental: any,
  currentUserId: string
): boolean => {
  // Can only raise disputes on active or completed rentals
  if (!['active', 'completed'].includes(rental.status)) {
    return false;
  }

  // Must be owner or renter
  const isParticipant =
    rental.ownerId === currentUserId || rental.renterId === currentUserId;
  if (!isParticipant) {
    return false;
  }

  // Cannot raise dispute if one already exists
  if (rental.dispute && rental.dispute.status !== 'resolved') {
    return false;
  }

  return true;
};

/**
 * Get dispute history for a user
 */
export const getDisputeHistory = async (userId: string): Promise<any[]> => {
  try {
    const rentalsRef = collection(db, 'rentals');
    const q = query(
      rentalsRef,
      where('dispute', '!=', null),
      orderBy('dispute.raisedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const disputes = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(
        (rental: any) =>
          rental.ownerId === userId || rental.renterId === userId
      );

    return disputes;
  } catch (error) {
    console.error('Error fetching dispute history:', error);
    throw error;
  }
};

/**
 * Get dispute outcome message for user
 */
export const getDisputeOutcomeMessage = (
  rental: any,
  currentUserId: string
): string => {
  const dispute = rental.dispute;
  if (!dispute || !dispute.resolution) {
    return '';
  }

  const isRenter = rental.renterId === currentUserId;
  const decision = dispute.resolution.decision;

  if (decision === 'favor_renter') {
    return isRenter
      ? `Dispute resolved in your favor. Refund: ${rental.pricing.currency} ${dispute.resolution.refundAmount}`
      : `Dispute resolved in favor of renter. Compensation: ${rental.pricing.currency} ${dispute.resolution.ownerCompensation}`;
  } else if (decision === 'favor_owner') {
    return isRenter
      ? `Dispute resolved in favor of owner. Refund: ${rental.pricing.currency} ${dispute.resolution.refundAmount}`
      : `Dispute resolved in your favor. Compensation: ${rental.pricing.currency} ${dispute.resolution.ownerCompensation}`;
  } else {
    return `Dispute resolved with split decision. Your amount: ${rental.pricing.currency} ${
      isRenter
        ? dispute.resolution.refundAmount
        : dispute.resolution.ownerCompensation
    }`;
  }
};

/**
 * Get dispute status color for UI
 */
export const getDisputeStatusColor = (
  status: 'open' | 'under_review' | 'resolved'
): string => {
  switch (status) {
    case 'open':
      return '#FF6B6B'; // Red
    case 'under_review':
      return '#FFA500'; // Orange
    case 'resolved':
      return '#4CAF50'; // Green
    default:
      return '#9E9E9E'; // Gray
  }
};

/**
 * Get dispute status label
 */
export const getDisputeStatusLabel = (
  status: 'open' | 'under_review' | 'resolved'
): string => {
  switch (status) {
    case 'open':
      return 'Dispute Open';
    case 'under_review':
      return 'Under Review';
    case 'resolved':
      return 'Resolved';
    default:
      return 'Unknown';
  }
};
