/**
 * Handover Service
 * Manages rental item handover confirmations between owner and renter
 */

import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';

export interface HandoverStatus {
  renterConfirmed: boolean;
  ownerConfirmed: boolean;
  renterConfirmedAt?: Date;
  ownerConfirmedAt?: Date;
  bothConfirmed: boolean;
}

export interface ConfirmHandoverResult {
  success: boolean;
  bothConfirmed: boolean;
  message: string;
}

/**
 * Confirm handover as renter (item received)
 */
export const confirmHandoverAsRenter = async (
  rentalId: string
): Promise<ConfirmHandoverResult> => {
  try {
    const confirmHandover = httpsCallable<
      { rentalId: string },
      ConfirmHandoverResult
    >(functions, 'confirmHandoverRenter');

    const result = await confirmHandover({ rentalId });
    return result.data;
  } catch (error) {
    console.error('Error confirming handover as renter:', error);
    throw error;
  }
};

/**
 * Confirm handover as owner (item handed over)
 */
export const confirmHandoverAsOwner = async (
  rentalId: string
): Promise<ConfirmHandoverResult> => {
  try {
    const confirmHandover = httpsCallable<
      { rentalId: string },
      ConfirmHandoverResult
    >(functions, 'confirmHandoverOwner');

    const result = await confirmHandover({ rentalId });
    return result.data;
  } catch (error) {
    console.error('Error confirming handover as owner:', error);
    throw error;
  }
};

/**
 * Get handover status from rental object
 */
export const getHandoverStatus = (rental: any): HandoverStatus => {
  const handover = rental.handover || {};
  
  return {
    renterConfirmed: handover.renterConfirmed || false,
    ownerConfirmed: handover.ownerConfirmed || false,
    renterConfirmedAt: handover.renterConfirmedAt?.toDate(),
    ownerConfirmedAt: handover.ownerConfirmedAt?.toDate(),
    bothConfirmed: !!(handover.renterConfirmed && handover.ownerConfirmed),
  };
};

/**
 * Check if user can confirm handover
 */
export const canConfirmHandover = (
  rental: any,
  currentUserId: string
): boolean => {
  // Must be in awaiting_handover status
  if (rental.status !== 'awaiting_handover') {
    return false;
  }

  const handover = rental.handover || {};
  const isOwner = rental.ownerId === currentUserId;
  const isRenter = rental.renterId === currentUserId;

  if (isOwner) {
    return !handover.ownerConfirmed;
  } else if (isRenter) {
    return !handover.renterConfirmed;
  }

  return false;
};

/**
 * Get pending confirmation message
 */
export const getPendingConfirmationMessage = (
  rental: any,
  currentUserId: string
): string => {
  const handover = rental.handover || {};
  const isOwner = rental.ownerId === currentUserId;

  if (handover.renterConfirmed && handover.ownerConfirmed) {
    return 'Both parties have confirmed handover';
  }

  if (isOwner) {
    if (handover.ownerConfirmed) {
      return handover.renterConfirmed
        ? 'Handover complete'
        : 'Waiting for renter to confirm receiving the item';
    } else {
      return handover.renterConfirmed
        ? 'Renter confirmed. Please confirm handing over the item'
        : 'Waiting for handover confirmation from both parties';
    }
  } else {
    // Is renter
    if (handover.renterConfirmed) {
      return handover.ownerConfirmed
        ? 'Handover complete'
        : 'Waiting for owner to confirm handing over the item';
    } else {
      return handover.ownerConfirmed
        ? 'Owner confirmed. Please confirm receiving the item'
        : 'Waiting for handover confirmation from both parties';
    }
  }
};
