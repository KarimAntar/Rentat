/**
 * Rental Flow Service
 * Implements the complete rent payment flow state machine including:
 * - Handover confirmation (dual confirmation)
 * - Dispute management
 * - Enhanced wallet logic with PENDING/LOCKED/AVAILABLE states
 */

import * as admin from 'firebase-admin';
import { getFirestore } from '../config';

const db = getFirestore();

/**
 * Phase 3: Handover State Machine
 * Renter confirms they have received the item from the owner
 */
export async function confirmHandoverByRenter(
  rentalId: string,
  userId: string
): Promise<{ success: boolean; bothConfirmed: boolean }> {
  const rentalRef = db.collection('rentals').doc(rentalId);
  const rentalDoc = await rentalRef.get();

  if (!rentalDoc.exists) {
    throw new Error('Rental not found');
  }

  const rental = rentalDoc.data()!;

  // Verify user is the renter
  if (rental.renterId !== userId) {
    throw new Error('Only the renter can confirm item handover');
  }

  // Verify rental is in awaiting_handover status
  if (rental.status !== 'awaiting_handover') {
    throw new Error('Rental must be in awaiting_handover status');
  }

  // Check if already confirmed
  console.log(`Handover check: userId=${userId}, rental:`, {
    renterId: rental.renterId,
    ownerId: rental.ownerId,
    status: rental.status,
    handover: rental.handover
  });

  if (rental.handover?.renterConfirmed) {
    console.log('Handover confirmation blocked: Renter has already confirmed handover');
    throw new Error('Renter has already confirmed handover');
  }

  const now = admin.firestore.Timestamp.now();

  // Update handover confirmation
  const updateData: any = {
    'handover.renterConfirmed': true,
    'handover.renterConfirmedAt': now,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    timeline: admin.firestore.FieldValue.arrayUnion({
      event: 'handover_confirmed_by_renter',
      timestamp: now,
      actor: userId,
      details: { message: 'Renter confirmed receiving the item' },
    }),
  };

  // Check if owner has already confirmed
  const ownerConfirmed = rental.handover?.ownerConfirmed || false;

  // If both parties have confirmed, activate the rental
  if (ownerConfirmed) {
    updateData.status = 'active';
    updateData['dates.actualStart'] = now;
    updateData.timeline = admin.firestore.FieldValue.arrayUnion(
      {
        event: 'handover_confirmed_by_renter',
        timestamp: now,
        actor: userId,
        details: { message: 'Renter confirmed receiving the item' },
      },
      {
        event: 'rental_activated',
        timestamp: now,
        actor: 'system',
        details: { message: 'Both parties confirmed handover - rental is now active' },
      }
    );
  }

  await rentalRef.update(updateData);

  return {
    success: true,
    bothConfirmed: ownerConfirmed,
  };
}

/**
 * Phase 3: Handover State Machine
 * Owner confirms they have handed over the item to the renter
 */
export async function confirmHandoverByOwner(
  rentalId: string,
  userId: string
): Promise<{ success: boolean; bothConfirmed: boolean }> {
  const rentalRef = db.collection('rentals').doc(rentalId);
  const rentalDoc = await rentalRef.get();

  if (!rentalDoc.exists) {
    throw new Error('Rental not found');
  }

  const rental = rentalDoc.data()!;

  // Verify user is the owner
  if (rental.ownerId !== userId) {
    throw new Error('Only the owner can confirm item handover');
  }

  // Verify rental is in awaiting_handover status
  if (rental.status !== 'awaiting_handover') {
    throw new Error('Rental must be in awaiting_handover status');
  }

  // Check if already confirmed
  if (rental.handover?.ownerConfirmed) {
    throw new Error('Owner has already confirmed handover');
  }

  const now = admin.firestore.Timestamp.now();

  // Update handover confirmation
  const updateData: any = {
    'handover.ownerConfirmed': true,
    'handover.ownerConfirmedAt': now,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    timeline: admin.firestore.FieldValue.arrayUnion({
      event: 'handover_confirmed_by_owner',
      timestamp: now,
      actor: userId,
      details: { message: 'Owner confirmed handing over the item' },
    }),
  };

  // Check if renter has already confirmed
  const renterConfirmed = rental.handover?.renterConfirmed || false;

  // If both parties have confirmed, activate the rental
  if (renterConfirmed) {
    updateData.status = 'active';
    updateData['dates.actualStart'] = now;
    updateData.timeline = admin.firestore.FieldValue.arrayUnion(
      {
        event: 'handover_confirmed_by_owner',
        timestamp: now,
        actor: userId,
        details: { message: 'Owner confirmed handing over the item' },
      },
      {
        event: 'rental_activated',
        timestamp: now,
        actor: 'system',
        details: { message: 'Both parties confirmed handover - rental is now active' },
      }
    );
  }

  await rentalRef.update(updateData);

  return {
    success: true,
    bothConfirmed: renterConfirmed,
  };
}

/**
 * Phase 4: Dispute Management
 * Raise a dispute about a rental (can be called by owner or renter)
 */
export async function raiseDispute(
  rentalId: string,
  userId: string,
  reason: string,
  evidence: string[]
): Promise<{ success: boolean; disputeId: string; message: string }> {
  console.log(`raiseDispute called: rentalId=${rentalId}, userId=${userId}, reason=${reason}`);

  try {
    const rentalRef = db.collection('rentals').doc(rentalId);
    const rentalDoc = await rentalRef.get();

    if (!rentalDoc.exists) {
      throw new Error(`Rental ${rentalId} not found`);
    }

    const rental = rentalDoc.data()!;
    console.log(`Rental found: status=${rental.status}, ownerId=${rental.ownerId}, renterId=${rental.renterId}`);

    // Verify user is either owner or renter
    const isOwner = rental.ownerId === userId;
    const isRenter = rental.renterId === userId;

    if (!isOwner && !isRenter) {
      throw new Error(`User ${userId} is not authorized to raise disputes for rental ${rentalId}`);
    }

    // Check if rental can have disputes (must be active or completed)
    if (rental.status !== 'active' && rental.status !== 'completed') {
      throw new Error(`Cannot raise dispute for rental with status: ${rental.status}. Must be active or completed.`);
    }

    // Check if dispute already exists
    if (rental.dispute && rental.dispute.status !== 'resolved') {
      throw new Error('An active dispute already exists for this rental');
    }

    const now = admin.firestore.Timestamp.now();
    const initiatedBy = isOwner ? 'owner' : 'renter';

    console.log(`Creating dispute: status=disputed, initiatedBy=${initiatedBy}`);

    // Update rental with dispute status and dispute data
    await rentalRef.update({
      status: 'disputed',
      dispute: {
        status: 'open',
        initiatedBy,
        reason,
        evidence,
        initiatedAt: now,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Rental status updated, now adding timeline entry');

    // Add timeline entry separately to avoid complex arrayUnion operations
    await rentalRef.update({
      timeline: admin.firestore.FieldValue.arrayUnion({
        event: 'dispute_raised',
        timestamp: now,
        actor: userId,
        details: {
          initiatedBy,
          reason,
          evidenceCount: evidence.length,
        },
      }),
    });

    console.log('Timeline entry added, now sending notification');

    // Notify the other party and moderators
    const otherPartyId = isOwner ? rental.renterId : rental.ownerId;

    try {
      // Create notification for other party
      await db.collection('notifications').add({
        userId: otherPartyId,
        type: 'system',
        title: 'Dispute Raised',
        body: `A dispute has been raised for your rental. Reason: ${reason}`,
        data: {
          rentalId,
          itemId: rental.itemId,
          disputeStatus: 'open',
        },
        status: 'unread',
        delivery: {
          push: { sent: false },
        },
        priority: 'high',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Notification sent to ${otherPartyId}`);
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Don't fail the entire operation due to notification error
    }

    console.log(`Dispute raised successfully for rental ${rentalId}`);

    return {
      success: true,
      disputeId: rentalId,
      message: 'Dispute raised successfully'
    };
  } catch (error: any) {
    console.error('Error in raiseDispute:', error);
    throw error; // Re-throw to be handled by Firebase function
  }
}

/**
 * Phase 4: Dispute Management
 * Resolve a dispute (moderator/admin only)
 */
export async function resolveDispute(
  rentalId: string,
  moderatorId: string,
  decision: string,
  refundAmount: number,
  ownerCompensation: number
): Promise<{ success: boolean }> {
  const rentalRef = db.collection('rentals').doc(rentalId);
  const rentalDoc = await rentalRef.get();

  if (!rentalDoc.exists) {
    throw new Error('Rental not found');
  }

  const rental = rentalDoc.data()!;

  // Verify rental has an active dispute
  if (!rental.dispute || rental.dispute.status === 'resolved') {
    throw new Error('No active dispute found for this rental');
  }

  // TODO: Add moderator role verification here
  // For now, we'll assume the moderatorId has been verified externally

  const now = admin.firestore.Timestamp.now();

  // Update dispute with resolution
  await rentalRef.update({
    status: 'completed',
    'dispute.status': 'resolved',
    'dispute.moderatorId': moderatorId,
    'dispute.resolution': {
      decision,
      refundAmount,
      ownerCompensation,
      resolvedAt: now,
      resolvedBy: moderatorId,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    timeline: admin.firestore.FieldValue.arrayUnion({
      event: 'dispute_resolved',
      timestamp: now,
      actor: moderatorId,
      details: {
        decision,
        refundAmount,
        ownerCompensation,
      },
    }),
  });

  // Process financial transactions based on resolution
  const batch = db.batch();

  // Refund to renter (from security deposit)
  if (refundAmount > 0) {
    const renterTxRef = db.collection('wallet_transactions').doc();
    batch.set(renterTxRef, {
      userId: rental.renterId,
      type: 'deposit_refund',
      amount: refundAmount,
      currency: rental.pricing.currency,
      status: 'completed',
      availabilityStatus: 'AVAILABLE',
      relatedRentalId: rentalId,
      relatedItemId: rental.itemId,
      payment: {
        description: `Dispute resolution: Deposit refund - ${decision}`,
      },
      metadata: {
        originalDeposit: rental.pricing.securityDeposit,
        netAmount: refundAmount,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Compensation to owner
  if (ownerCompensation > 0) {
    const ownerTxRef = db.collection('wallet_transactions').doc();
    batch.set(ownerTxRef, {
      userId: rental.ownerId,
      type: 'rental_income',
      amount: ownerCompensation,
      currency: rental.pricing.currency,
      status: 'completed',
      availabilityStatus: 'AVAILABLE',
      relatedRentalId: rentalId,
      relatedItemId: rental.itemId,
      payment: {
        description: `Dispute resolution: Owner compensation - ${decision}`,
      },
      metadata: {
        netAmount: ownerCompensation,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update owner wallet
    batch.update(db.collection('users').doc(rental.ownerId), {
      'wallet.balance': admin.firestore.FieldValue.increment(ownerCompensation),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  // Notify both parties
  await Promise.all([
    db.collection('notifications').add({
      userId: rental.ownerId,
      type: 'system',
      title: 'Dispute Resolved',
      body: `The dispute for your rental has been resolved. ${decision}`,
      data: { rentalId, itemId: rental.itemId },
      status: 'unread',
      delivery: { push: { sent: false } },
      priority: 'high',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
    db.collection('notifications').add({
      userId: rental.renterId,
      type: 'system',
      title: 'Dispute Resolved',
      body: `The dispute for your rental has been resolved. ${decision}`,
      data: { rentalId, itemId: rental.itemId },
      status: 'unread',
      delivery: { push: { sent: false } },
      priority: 'high',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
  ]);

  return { success: true };
}

/**
 * Phase 5: Wallet & Payouts
 * Get wallet balance with proper separation of Available vs Pending/Locked funds
 * Only includes POSITIVE amounts (credits/income) - excludes negative amounts (expenses/payments)
 */
export async function getWalletBalance(userId: string): Promise<{
  available: number;
  pending: number;
  locked: number;
  total: number;
  currency: string;
}> {
  // Get all wallet transactions for this user
  const transactionsSnapshot = await db
    .collection('wallet_transactions')
    .where('userId', '==', userId)
    .where('status', '==', 'completed')
    .get();

  let available = 0;
  let pending = 0;
  let locked = 0;
  const currency = 'EGP'; // Default currency

  transactionsSnapshot.forEach((doc) => {
    const tx = doc.data();
    const amount = tx.amount || 0;

    // Only include POSITIVE amounts (credits/income) in wallet calculations
    // This excludes negative amounts (like rental payments made by the user)
    if (amount <= 0) {
      return; // Skip negative amounts/expenses
    }

    const availabilityStatus = tx.availabilityStatus;

    if (availabilityStatus === 'AVAILABLE') {
      available += amount;
    } else if (availabilityStatus === 'PENDING') {
      pending += amount;
    } else if (availabilityStatus === 'LOCKED') {
      locked += amount;
    } else {
      // Legacy transactions without availabilityStatus - treat as available
      available += amount;
    }
  });

  const total = available + pending + locked;

  return {
    available,
    pending,
    locked,
    total,
    currency,
  };
}

/**
 * Phase 2: Store Paymob transaction for audit trail
 */
export async function storePaymobTransaction(
  rentalId: string,
  paymobOrderId: number,
  paymobTransactionId: string,
  amount: number,
  currency: string,
  status: 'pending' | 'success' | 'failed',
  hmac: string | undefined,
  rawPayload: any
): Promise<void> {
  await db.collection('paymob_transactions').add({
    rentalId,
    paymobOrderId,
    paymobTransactionId,
    amount,
    currency,
    status,
    hmac,
    rawPayload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    processedAt: status !== 'pending' ? admin.firestore.FieldValue.serverTimestamp() : null,
  });
}

/**
 * Helper: Update wallet transaction availability status
 */
export async function updateTransactionAvailability(
  transactionId: string,
  newStatus: 'PENDING' | 'LOCKED' | 'AVAILABLE'
): Promise<void> {
  await db.collection('wallet_transactions').doc(transactionId).update({
    availabilityStatus: newStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
