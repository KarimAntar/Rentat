/**
 * Wallet Service
 * Enhanced wallet management with detailed balance breakdown
 */

import { functions, db } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export interface WalletBalance {
  available: number;
  pending: number;
  locked: number;
  total: number;
  currency: string;
  totalEarnings: number;
  totalWithdrawn: number;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  availabilityStatus?: 'AVAILABLE' | 'PENDING' | 'LOCKED';
  relatedRentalId?: string;
  relatedItemId?: string;
  description?: string;
  createdAt: Date;
  processedAt?: Date;
}

/**
 * Get detailed wallet balance with breakdown
 */
export const getDetailedWalletBalance = async (
  userId?: string
): Promise<WalletBalance> => {
  try {
    const getBalance = httpsCallable<
      { userId?: string },
      WalletBalance
    >(functions, 'getWalletBalanceFunction');

    const result = await getBalance(userId ? { userId } : {});
    return result.data;
  } catch (error) {
    console.error('Error getting detailed wallet balance:', error);
    throw error;
  }
};

/**
 * Get wallet transactions for a user
 */
export const getWalletTransactions = async (
  userId: string,
  limitCount: number = 50
): Promise<WalletTransaction[]> => {
  try {
    const transactionsRef = collection(db, 'wallet_transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    })) as WalletTransaction[];
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    throw error;
  }
};

/**
 * Get transactions by status
 */
export const getTransactionsByStatus = async (
  userId: string,
  status: string
): Promise<WalletTransaction[]> => {
  try {
    const transactionsRef = collection(db, 'wallet_transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    })) as WalletTransaction[];
  } catch (error) {
    console.error('Error fetching transactions by status:', error);
    throw error;
  }
};

/**
 * Get transactions by availability status
 */
export const getTransactionsByAvailability = async (
  userId: string,
  availabilityStatus: 'AVAILABLE' | 'PENDING' | 'LOCKED'
): Promise<WalletTransaction[]> => {
  try {
    const transactionsRef = collection(db, 'wallet_transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('availabilityStatus', '==', availabilityStatus),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    })) as WalletTransaction[];
  } catch (error) {
    console.error('Error fetching transactions by availability:', error);
    throw error;
  }
};

/**
 * Format currency amount for display
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'EGP'
): string => {
  return `${currency} ${amount.toFixed(2)}`;
};

/**
 * Get wallet balance color for UI
 */
export const getBalanceTypeColor = (
  type: 'available' | 'pending' | 'locked'
): string => {
  switch (type) {
    case 'available':
      return '#4CAF50'; // Green
    case 'pending':
      return '#FFA500'; // Orange
    case 'locked':
      return '#FF6B6B'; // Red
    default:
      return '#9E9E9E'; // Gray
  }
};

/**
 * Get transaction type label
 */
export const getTransactionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    rental_payment: 'Rental Payment',
    rental_income: 'Rental Income',
    rental_payout: 'Rental Payout',
    deposit_refund: 'Deposit Refund',
    deposit_release: 'Deposit Release',
    withdrawal_request: 'Withdrawal Request',
    platform_fee: 'Platform Fee',
    damage_compensation: 'Damage Compensation',
  };

  return labels[type] || type;
};

/**
 * Get transaction status color
 */
export const getTransactionStatusColor = (status: string): string => {
  switch (status) {
    case 'completed':
      return '#4CAF50'; // Green
    case 'pending':
      return '#FFA500'; // Orange
    case 'failed':
      return '#FF6B6B'; // Red
    default:
      return '#9E9E9E'; // Gray
  }
};

/**
 * Get availability status label
 */
export const getAvailabilityStatusLabel = (
  status: 'AVAILABLE' | 'PENDING' | 'LOCKED'
): string => {
  switch (status) {
    case 'AVAILABLE':
      return 'Available';
    case 'PENDING':
      return 'Pending';
    case 'LOCKED':
      return 'Locked';
    default:
      return 'Unknown';
  }
};

/**
 * Get availability status description
 */
export const getAvailabilityStatusDescription = (
  status: 'AVAILABLE' | 'PENDING' | 'LOCKED'
): string => {
  switch (status) {
    case 'AVAILABLE':
      return 'Can be withdrawn';
    case 'PENDING':
      return 'In active rentals';
    case 'LOCKED':
      return 'In disputes';
    default:
      return '';
  }
};

/**
 * Calculate percentage of balance type
 */
export const calculateBalancePercentage = (
  amount: number,
  total: number
): number => {
  if (total === 0) return 0;
  return (amount / total) * 100;
};

/**
 * Request payout from wallet
 */
export const requestPayout = async (
  amount: number,
  method: 'bank_transfer' | 'mobile_wallet'
): Promise<any> => {
  try {
    const request = httpsCallable(functions, 'requestPayout');
    const result = await request({ amount, method });
    return result.data;
  } catch (error) {
    console.error('Error requesting payout:', error);
    throw error;
  }
};

/**
 * Get payout requests for user
 */
export const getPayoutRequests = async (userId: string): Promise<any[]> => {
  try {
    const requestsRef = collection(db, 'payout_requests');
    const q = query(
      requestsRef,
      where('userId', '==', userId),
      orderBy('requestedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      requestedAt: doc.data().requestedAt?.toDate(),
      processedAt: doc.data().processedAt?.toDate(),
    }));
  } catch (error) {
    console.error('Error fetching payout requests:', error);
    throw error;
  }
};
