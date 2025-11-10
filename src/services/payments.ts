import {
  doc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  runTransaction,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { Rental, WalletTransaction, User } from '../types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// Note: All Stripe operations are now handled server-side through Firebase Functions
// for security and compatibility reasons.

export interface PaymentIntentData {
  amount: number; // in cents
  currency: string;
  rentalId: string;
  customerId: string;
  metadata?: Record<string, string>;
}

export interface EscrowPayment {
  id: string;
  rentalId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: 'held' | 'released_to_owner' | 'refunded_to_renter' | 'partially_refunded';
  holdUntil: Date;
  releasedAt?: Date;
  refundAmount?: number;
  damageClaimAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DamageClaim {
  id: string;
  rentalId: string;
  claimedBy: string; // userId
  description: string;
  images: string[];
  amount: number;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resolved';
  resolution?: {
    decision: 'owner_favor' | 'renter_favor' | 'split';
    amount: number;
    notes: string;
    resolvedBy: string;
    resolvedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class EnhancedPaymentsService {
  private static instance: EnhancedPaymentsService;

  private constructor() {
    // Stripe operations moved to Firebase Functions
  }

  public static getInstance(): EnhancedPaymentsService {
    if (!EnhancedPaymentsService.instance) {
      EnhancedPaymentsService.instance = new EnhancedPaymentsService();
    }
    return EnhancedPaymentsService.instance;
  }

  // Create escrow payment for rental - handled by Firebase Functions
  public async createEscrowPayment(
    rentalId: string,
    amount: number,
    currency: string = 'usd'
  ): Promise<string> {
    try {
      const createEscrowFunction = httpsCallable(functions, 'createEscrowPayment');
      const result = await createEscrowFunction({
        rentalId,
        amount,
        currency,
      });

      return result.data as string;
    } catch (error) {
      console.error('Error creating escrow payment:', error);
      throw new Error('Failed to create escrow payment');
    }
  }

  // Release escrow payment to owner - handled by Firebase Functions
  public async releaseEscrowToOwner(
    escrowId: string,
    amount?: number // Partial release amount
  ): Promise<void> {
    try {
      const releaseEscrowFunction = httpsCallable(functions, 'releaseEscrowToOwner');
      await releaseEscrowFunction({
        escrowId,
        amount,
      });
    } catch (error) {
      console.error('Error releasing escrow to owner:', error);
      throw new Error('Failed to release escrow payment');
    }
  }

  // Refund escrow payment to renter - handled by Firebase Functions
  public async refundEscrowToRenter(
    escrowId: string,
    amount?: number, // Partial refund amount
    reason?: string
  ): Promise<void> {
    try {
      const refundEscrowFunction = httpsCallable(functions, 'refundEscrowToRenter');
      await refundEscrowFunction({
        escrowId,
        amount,
        reason,
      });
    } catch (error) {
      console.error('Error refunding escrow to renter:', error);
      throw new Error('Failed to refund escrow payment');
    }
  }

  // Submit damage claim
  public async submitDamageClaim(
    rentalId: string,
    claimedBy: string,
    description: string,
    images: string[],
    amount: number
  ): Promise<string> {
    try {
      const claimDoc = {
        rentalId,
        claimedBy,
        description,
        images,
        amount,
        status: 'submitted' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'damage_claims'), claimDoc);

      // Update rental status
      await updateDoc(doc(db, collections.rentals, rentalId), {
        status: 'disputed',
        'completion.damageReported': {
          by: claimedBy,
          description,
          images,
          amount,
        },
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error submitting damage claim:', error);
      throw new Error('Failed to submit damage claim');
    }
  }

  // Resolve damage claim
  public async resolveDamageClaim(
    claimId: string,
    decision: 'owner_favor' | 'renter_favor' | 'split',
    amount: number,
    notes: string,
    resolvedBy: string
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get damage claim
        const claimRef = doc(db, 'damage_claims', claimId);
        const claimDoc = await transaction.get(claimRef);
        
        if (!claimDoc.exists()) {
          throw new Error('Damage claim not found');
        }

        const claim = claimDoc.data() as DamageClaim;
        
        // Update claim with resolution
        transaction.update(claimRef, {
          status: 'resolved',
          resolution: {
            decision,
            amount,
            notes,
            resolvedBy,
            resolvedAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        });

        // Get associated escrow payment
        const escrowQuery = query(
          collection(db, 'escrow_payments'),
          where('rentalId', '==', claim.rentalId)
        );
        const escrowSnapshot = await getDocs(escrowQuery);
        
        if (!escrowSnapshot.empty) {
          const escrowDoc = escrowSnapshot.docs[0];
          const escrow = escrowDoc.data() as EscrowPayment;
          
          // Update escrow with damage claim amount
          transaction.update(escrowDoc.ref, {
            damageClaimAmount: amount,
            updatedAt: serverTimestamp(),
          });

          // Handle payment distribution based on decision
          if (decision === 'owner_favor') {
            // Release full amount to owner
            await this.releaseEscrowToOwner(escrowDoc.id);
          } else if (decision === 'renter_favor') {
            // Refund full amount to renter
            await this.refundEscrowToRenter(escrowDoc.id, escrow.amount, 'Damage claim resolved in renter favor');
          } else {
            // Split decision - release partial amounts
            const ownerAmount = escrow.amount - amount;
            const renterAmount = amount;
            
            if (ownerAmount > 0) {
              await this.releaseEscrowToOwner(escrowDoc.id, ownerAmount);
            }
            if (renterAmount > 0) {
              await this.refundEscrowToRenter(escrowDoc.id, renterAmount, 'Damage claim partial resolution');
            }
          }
        }

        // Update rental status
        const rentalRef = doc(db, collections.rentals, claim.rentalId);
        transaction.update(rentalRef, {
          status: 'completed',
          'completion.completedAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('Error resolving damage claim:', error);
      throw new Error('Failed to resolve damage claim');
    }
  }

  // Auto-release escrow after rental completion
  public async autoReleaseEscrow(escrowId: string): Promise<void> {
    try {
      const escrowDoc = await getDoc(doc(db, 'escrow_payments', escrowId));
      
      if (!escrowDoc.exists()) {
        throw new Error('Escrow payment not found');
      }

      const escrow = escrowDoc.data() as EscrowPayment;
      
      // Check if hold period has passed and no damage claims
      const now = new Date();
      const holdUntil = new Date(escrow.holdUntil);
      
      if (now > holdUntil && escrow.status === 'held') {
        // Check for active damage claims
        const claimsQuery = query(
          collection(db, 'damage_claims'),
          where('rentalId', '==', escrow.rentalId),
          where('status', 'in', ['submitted', 'under_review'])
        );
        const claimsSnapshot = await getDocs(claimsQuery);
        
        if (claimsSnapshot.empty) {
          // No active claims, release to owner
          await this.releaseEscrowToOwner(escrowId);
        }
      }
    } catch (error) {
      console.error('Error auto-releasing escrow:', error);
      throw new Error('Failed to auto-release escrow');
    }
  }

  // Get rental details
  private async getRental(rentalId: string): Promise<Rental | null> {
    try {
      const rentalDoc = await getDoc(doc(db, collections.rentals, rentalId));
      
      if (!rentalDoc.exists()) {
        return null;
      }

      return {
        id: rentalDoc.id,
        ...rentalDoc.data(),
        dates: {
          ...rentalDoc.data().dates,
          requestedStart: rentalDoc.data().dates.requestedStart?.toDate(),
          requestedEnd: rentalDoc.data().dates.requestedEnd?.toDate(),
          confirmedStart: rentalDoc.data().dates.confirmedStart?.toDate(),
          confirmedEnd: rentalDoc.data().dates.confirmedEnd?.toDate(),
          actualStart: rentalDoc.data().dates.actualStart?.toDate(),
          actualEnd: rentalDoc.data().dates.actualEnd?.toDate(),
        },
        createdAt: rentalDoc.data().createdAt?.toDate(),
        updatedAt: rentalDoc.data().updatedAt?.toDate(),
      } as Rental;
    } catch (error) {
      console.error('Error getting rental:', error);
      return null;
    }
  }

  // Update user wallet balance
  private async updateUserWallet(userId: string, amount: number): Promise<void> {
    try {
      const userRef = doc(db, collections.users, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const user = userDoc.data() as User;
      const currentBalance = user.wallet?.balance || 0;
      const currentEarnings = user.wallet?.totalEarnings || 0;

      await updateDoc(userRef, {
        'wallet.balance': currentBalance + amount,
        'wallet.totalEarnings': currentEarnings + amount,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user wallet:', error);
      throw new Error('Failed to update user wallet');
    }
  }

  // Get payment methods for user - handled by Firebase Functions
  public async getPaymentMethods(customerId: string): Promise<any[]> {
    try {
      const getPaymentMethodsFunction = httpsCallable(functions, 'getPaymentMethods');
      const result = await getPaymentMethodsFunction({ customerId });
      return result.data as any[];
    } catch (error) {
      console.error('Error getting payment methods:', error);
      throw new Error('Failed to get payment methods');
    }
  }

  // Setup intent for adding payment method - handled by Firebase Functions
  public async createSetupIntent(customerId: string): Promise<string> {
    try {
      const createSetupIntentFunction = httpsCallable(functions, 'createSetupIntent');
      const result = await createSetupIntentFunction({ customerId });
      return result.data as string;
    } catch (error) {
      console.error('Error creating setup intent:', error);
      throw new Error('Failed to create setup intent');
    }
  }

  // Create connected account for payouts - handled by Firebase Functions
  public async createConnectedAccount(userId: string, email: string): Promise<string> {
    try {
      const createConnectedAccountFunction = httpsCallable(functions, 'createConnectedAccount');
      const result = await createConnectedAccountFunction({ userId, email });
      return result.data as string;
    } catch (error) {
      console.error('Error creating connected account:', error);
      throw new Error('Failed to create connected account');
    }
  }

  // Process immediate payment (for boosts, subscriptions, etc.) - handled by Firebase Functions
  public async processPayment(data: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    description: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string; status: string }> {
    try {
      const processPaymentFunction = httpsCallable(functions, 'processPayment');
      const result = await processPaymentFunction(data);
      return result.data as { id: string; status: string };
    } catch (error) {
      console.error('Error processing payment:', error);
      throw new Error('Failed to process payment');
    }
  }

  // Calculate platform fees
  public calculatePlatformFee(amount: number): {
    platformFee: number;
    processingFee: number;
    netAmount: number;
  } {
    const platformFeePercent = 0.10; // 10%
    const processingFeePercent = 0.029; // 2.9%
    const processingFeeFixed = 30; // $0.30 in cents

    const platformFee = Math.round(amount * platformFeePercent);
    const processingFee = Math.round(amount * processingFeePercent) + processingFeeFixed;
    const netAmount = amount - platformFee - processingFee;

    return {
      platformFee,
      processingFee,
      netAmount: Math.max(0, netAmount),
    };
  }
}

// Export singleton instance
export const enhancedPaymentsService = EnhancedPaymentsService.getInstance();

// Convenience hook
export const useEnhancedPayments = () => {
  return {
    createEscrowPayment: enhancedPaymentsService.createEscrowPayment.bind(enhancedPaymentsService),
    releaseEscrowToOwner: enhancedPaymentsService.releaseEscrowToOwner.bind(enhancedPaymentsService),
    refundEscrowToRenter: enhancedPaymentsService.refundEscrowToRenter.bind(enhancedPaymentsService),
    submitDamageClaim: enhancedPaymentsService.submitDamageClaim.bind(enhancedPaymentsService),
    resolveDamageClaim: enhancedPaymentsService.resolveDamageClaim.bind(enhancedPaymentsService),
    autoReleaseEscrow: enhancedPaymentsService.autoReleaseEscrow.bind(enhancedPaymentsService),
    getPaymentMethods: enhancedPaymentsService.getPaymentMethods.bind(enhancedPaymentsService),
    createSetupIntent: enhancedPaymentsService.createSetupIntent.bind(enhancedPaymentsService),
    createConnectedAccount: enhancedPaymentsService.createConnectedAccount.bind(enhancedPaymentsService),
    calculatePlatformFee: enhancedPaymentsService.calculatePlatformFee.bind(enhancedPaymentsService),
  };
};

export default enhancedPaymentsService;
