import { collection, doc, addDoc, updateDoc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Deposit, DepositAction } from '../types/dashboard';

/**
 * Service for managing security deposit operations
 */

/**
 * Create a new deposit record when a rental is created
 */
export const createDeposit = async (
  rentalId: string,
  userId: string,
  amount: number,
  currency: string = 'EGP'
): Promise<string> => {
  try {
    const depositsRef = collection(db, 'deposits');
    
    const depositData = {
      rentalId,
      userId,
      amount,
      currency,
      status: 'held',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(depositsRef, depositData);
    return docRef.id;
  } catch (error: any) {
    console.error('Error creating deposit:', error);
    throw new Error(`Failed to create deposit: ${error.message}`);
  }
};

/**
 * Release full deposit amount back to user
 */
export const releaseDeposit = async (
  depositId: string,
  reason: string
): Promise<void> => {
  try {
    const depositRef = doc(db, 'deposits', depositId);
    const depositSnap = await getDoc(depositRef);

    if (!depositSnap.exists()) {
      throw new Error('Deposit not found');
    }

    const deposit = depositSnap.data() as Deposit;

    if (deposit.status !== 'held') {
      throw new Error('Can only release deposits that are currently held');
    }

    await updateDoc(depositRef, {
      status: 'released',
      releaseReason: reason,
      updatedAt: Timestamp.now(),
    });

    // Create wallet transaction for the released deposit
    await createDepositTransaction(deposit.userId, deposit.amount, 'deposit_release', depositId);
  } catch (error: any) {
    console.error('Error releasing deposit:', error);
    throw new Error(`Failed to release deposit: ${error.message}`);
  }
};

/**
 * Release partial deposit amount (e.g., for damage deduction)
 */
export const releasePartialDeposit = async (
  depositId: string,
  partialAmount: number,
  reason: string
): Promise<void> => {
  try {
    const depositRef = doc(db, 'deposits', depositId);
    const depositSnap = await getDoc(depositRef);

    if (!depositSnap.exists()) {
      throw new Error('Deposit not found');
    }

    const deposit = depositSnap.data() as Deposit;

    if (deposit.status !== 'held') {
      throw new Error('Can only release deposits that are currently held');
    }

    if (partialAmount > deposit.amount) {
      throw new Error('Partial amount cannot exceed total deposit amount');
    }

    await updateDoc(depositRef, {
      status: 'partial_refund',
      partialAmount,
      releaseReason: reason,
      updatedAt: Timestamp.now(),
    });

    // Create wallet transaction for the partial release
    await createDepositTransaction(deposit.userId, partialAmount, 'deposit_refund', depositId);
  } catch (error: any) {
    console.error('Error releasing partial deposit:', error);
    throw new Error(`Failed to release partial deposit: ${error.message}`);
  }
};

/**
 * Hold deposit with a specific reason (admin action)
 */
export const holdDeposit = async (
  depositId: string,
  reason: string
): Promise<void> => {
  try {
    const depositRef = doc(db, 'deposits', depositId);
    const depositSnap = await getDoc(depositRef);

    if (!depositSnap.exists()) {
      throw new Error('Deposit not found');
    }

    await updateDoc(depositRef, {
      status: 'held',
      holdReason: reason,
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    console.error('Error holding deposit:', error);
    throw new Error(`Failed to hold deposit: ${error.message}`);
  }
};

/**
 * Get deposits by user ID
 */
export const getDepositsByUser = async (userId: string): Promise<Deposit[]> => {
  try {
    const depositsRef = collection(db, 'deposits');
    const q = query(
      depositsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Deposit[];
  } catch (error: any) {
    console.error('Error fetching deposits by user:', error);
    throw new Error(`Failed to fetch deposits: ${error.message}`);
  }
};

/**
 * Get all held deposits (admin view)
 */
export const getAllHeldDeposits = async (): Promise<Deposit[]> => {
  try {
    const depositsRef = collection(db, 'deposits');
    const q = query(
      depositsRef,
      where('status', '==', 'held'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Deposit[];
  } catch (error: any) {
    console.error('Error fetching all held deposits:', error);
    throw new Error(`Failed to fetch held deposits: ${error.message}`);
  }
};

/**
 * Get deposit by rental ID
 */
export const getDepositByRentalId = async (rentalId: string): Promise<Deposit | null> => {
  try {
    const depositsRef = collection(db, 'deposits');
    const q = query(depositsRef, where('rentalId', '==', rentalId));

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    } as Deposit;
  } catch (error: any) {
    console.error('Error fetching deposit by rental ID:', error);
    throw new Error(`Failed to fetch deposit: ${error.message}`);
  }
};

/**
 * Process deposit action (used by admin)
 */
export const processDepositAction = async (action: DepositAction): Promise<void> => {
  try {
    switch (action.actionType) {
      case 'release_full':
        await releaseDeposit(action.depositId, action.reason);
        break;
      case 'release_partial':
        if (!action.amount) {
          throw new Error('Partial amount is required for partial release');
        }
        await releasePartialDeposit(action.depositId, action.amount, action.reason);
        break;
      case 'hold':
        await holdDeposit(action.depositId, action.reason);
        break;
      default:
        throw new Error(`Unknown action type: ${action.actionType}`);
    }
  } catch (error: any) {
    console.error('Error processing deposit action:', error);
    throw new Error(`Failed to process deposit action: ${error.message}`);
  }
};

/**
 * Helper function to create a wallet transaction for deposit operations
 */
const createDepositTransaction = async (
  userId: string,
  amount: number,
  type: 'deposit_release' | 'deposit_refund',
  depositId: string
): Promise<void> => {
  try {
    const transactionsRef = collection(db, 'wallet_transactions');
    
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
      createdAt: Timestamp.now(),
      processedAt: Timestamp.now(),
    };

    await addDoc(transactionsRef, transactionData);

    // Update user wallet balance
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentBalance = userData.wallet?.balance || 0;
      
      await updateDoc(userRef, {
        'wallet.balance': currentBalance + amount,
      });
    }
  } catch (error: any) {
    console.error('Error creating deposit transaction:', error);
    throw new Error(`Failed to create deposit transaction: ${error.message}`);
  }
};

/**
 * Get deposit statistics for a user
 */
export const getDepositStats = async (userId: string) => {
  try {
    const deposits = await getDepositsByUser(userId);
    
    const held = deposits.filter(d => d.status === 'held');
    const released = deposits.filter(d => d.status === 'released');
    const partialRefund = deposits.filter(d => d.status === 'partial_refund');
    
    const totalHeld = held.reduce((sum, d) => sum + d.amount, 0);
    const totalReleased = released.reduce((sum, d) => sum + d.amount, 0);
    const totalPartialRefund = partialRefund.reduce((sum, d) => sum + (d.partialAmount || 0), 0);
    
    return {
      totalDeposits: deposits.length,
      heldCount: held.length,
      releasedCount: released.length,
      partialRefundCount: partialRefund.length,
      totalHeldAmount: totalHeld,
      totalReleasedAmount: totalReleased,
      totalPartialRefundAmount: totalPartialRefund,
    };
  } catch (error: any) {
    console.error('Error getting deposit stats:', error);
    throw new Error(`Failed to get deposit stats: ${error.message}`);
  }
};
