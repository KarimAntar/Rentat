import { 
  doc, 
  updateDoc, 
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { Rental, WalletTransaction, User } from '../types';

export interface CommissionConfig {
  baseRate: number; // Base commission percentage (e.g., 0.10 for 10%)
  tierRates: {
    tier: string;
    minRentals: number;
    commissionRate: number;
    description: string;
  }[];
  categoryRates: {
    category: string;
    commissionRate: number;
  }[];
  minimumFee: number; // Minimum commission in cents
  maximumFee?: number; // Maximum commission in cents (optional)
}

export interface CommissionCalculation {
  rentalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  minimumFeApplied: boolean;
  maximumFeApplied: boolean;
  tier: string;
  category: string;
  ownerPayout: number;
  platformRevenue: number;
}

export interface RevenueAnalytics {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  totalRevenue: number;
  totalTransactions: number;
  averageCommission: number;
  topCategories: Array<{
    category: string;
    revenue: number;
    transactions: number;
  }>;
  topUsers: Array<{
    userId: string;
    displayName: string;
    revenue: number;
    transactions: number;
  }>;
  revenueBreakdown: {
    commissions: number;
    processingFees: number;
    subscriptionFees: number;
    boostFees: number;
  };
}

export class CommissionService {
  private static instance: CommissionService;
  private config: CommissionConfig;

  private constructor() {
    // Default commission configuration
    this.config = {
      baseRate: 0.10, // 10% base commission
      tierRates: [
        {
          tier: 'Bronze',
          minRentals: 0,
          commissionRate: 0.10,
          description: 'Standard rate for new users',
        },
        {
          tier: 'Silver',
          minRentals: 10,
          commissionRate: 0.08,
          description: 'Reduced rate for active users',
        },
        {
          tier: 'Gold',
          minRentals: 50,
          commissionRate: 0.06,
          description: 'Premium rate for power users',
        },
        {
          tier: 'Platinum',
          minRentals: 100,
          commissionRate: 0.05,
          description: 'Best rate for top performers',
        },
      ],
      categoryRates: [
        { category: 'electronics', commissionRate: 0.12 },
        { category: 'vehicles', commissionRate: 0.08 },
        { category: 'tools', commissionRate: 0.10 },
        { category: 'home-garden', commissionRate: 0.10 },
        { category: 'sports', commissionRate: 0.10 },
        { category: 'party-events', commissionRate: 0.15 },
        { category: 'music', commissionRate: 0.12 },
        { category: 'other', commissionRate: 0.10 },
      ],
      minimumFee: 50, // $0.50 minimum
      maximumFee: 5000, // $50.00 maximum
    };
  }

  public static getInstance(): CommissionService {
    if (!CommissionService.instance) {
      CommissionService.instance = new CommissionService();
    }
    return CommissionService.instance;
  }

  // Calculate commission for a rental
  public async calculateCommission(
    rentalAmount: number,
    ownerId: string,
    category: string
  ): Promise<CommissionCalculation> {
    try {
      // Get user's tier based on completed rentals
      const userTier = await this.getUserTier(ownerId);
      
      // Get commission rate based on tier and category
      const tierRate = this.getTierRate(userTier);
      const categoryRate = this.getCategoryRate(category);
      
      // Use the lower of tier rate or category rate (benefit to user)
      const commissionRate = Math.min(tierRate, categoryRate);
      
      // Calculate commission amount
      let commissionAmount = Math.round(rentalAmount * commissionRate);
      
      // Apply minimum and maximum fee constraints
      let minimumFeApplied = false;
      let maximumFeApplied = false;
      
      if (commissionAmount < this.config.minimumFee) {
        commissionAmount = this.config.minimumFee;
        minimumFeApplied = true;
      }
      
      if (this.config.maximumFee && commissionAmount > this.config.maximumFee) {
        commissionAmount = this.config.maximumFee;
        maximumFeApplied = true;
      }

      const ownerPayout = rentalAmount - commissionAmount;

      return {
        rentalAmount,
        commissionRate,
        commissionAmount,
        minimumFeApplied,
        maximumFeApplied,
        tier: userTier,
        category,
        ownerPayout,
        platformRevenue: commissionAmount,
      };
    } catch (error) {
      console.error('Error calculating commission:', error);
      throw new Error('Failed to calculate commission');
    }
  }

  // Process commission for a completed rental
  public async processCommission(rentalId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get rental details
        const rentalRef = doc(db, collections.rentals, rentalId);
        const rentalDoc = await transaction.get(rentalRef);
        
        if (!rentalDoc.exists()) {
          throw new Error('Rental not found');
        }

        const rental = rentalDoc.data() as Rental;
        
        if (rental.status !== 'completed') {
          throw new Error('Rental must be completed before processing commission');
        }

        // Calculate commission
        const commission = await this.calculateCommission(
          (rental.payment as any).totalAmount || (rental.payment as any).amount || 1000,
          rental.ownerId,
          (rental as any).itemCategory || (rental as any).item?.category || 'other'
        );

        // Create commission transaction record
        const commissionTransaction = {
          type: 'commission',
          rentalId,
          ownerId: rental.ownerId,
          renterId: rental.renterId,
          itemId: rental.itemId,
          amount: commission.commissionAmount,
          ownerPayout: commission.ownerPayout,
          commissionRate: commission.commissionRate,
          tier: commission.tier,
          category: commission.category,
          calculation: commission,
          status: 'completed',
          createdAt: serverTimestamp(),
          processedAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'commission_transactions'), commissionTransaction);

        // Update rental with commission info
        transaction.update(rentalRef, {
          'payment.commission': commission,
          'payment.commissionProcessed': true,
          'payment.commissionProcessedAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Create platform revenue record
        const revenueRecord = {
          type: 'commission_revenue',
          source: 'rental_commission',
          amount: commission.commissionAmount,
          rentalId,
          ownerId: rental.ownerId,
          category: commission.category,
          tier: commission.tier,
          date: serverTimestamp(),
          metadata: {
            rentalAmount: commission.rentalAmount,
            commissionRate: commission.commissionRate,
          },
        };

        await addDoc(collection(db, 'platform_revenue'), revenueRecord);
      });
    } catch (error) {
      console.error('Error processing commission:', error);
      throw new Error('Failed to process commission');
    }
  }

  // Get user's commission tier based on completed rentals
  private async getUserTier(ownerId: string): Promise<string> {
    try {
      // Count completed rentals as owner
      const rentalsQuery = query(
        collection(db, collections.rentals),
        where('ownerId', '==', ownerId),
        where('status', '==', 'completed')
      );

      const snapshot = await getDocs(rentalsQuery);
      const completedRentals = snapshot.size;

      // Find appropriate tier
      const tiers = this.config.tierRates.sort((a, b) => b.minRentals - a.minRentals);
      
      for (const tier of tiers) {
        if (completedRentals >= tier.minRentals) {
          return tier.tier;
        }
      }

      return 'Bronze'; // Default tier
    } catch (error) {
      console.error('Error getting user tier:', error);
      return 'Bronze';
    }
  }

  // Get commission rate for tier
  private getTierRate(tier: string): number {
    const tierConfig = this.config.tierRates.find(t => t.tier === tier);
    return tierConfig?.commissionRate || this.config.baseRate;
  }

  // Get commission rate for category
  private getCategoryRate(category: string): number {
    const categoryConfig = this.config.categoryRates.find(c => c.category === category);
    return categoryConfig?.commissionRate || this.config.baseRate;
  }

  // Get revenue analytics for a period
  public async getRevenueAnalytics(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: Date,
    endDate: Date
  ): Promise<RevenueAnalytics> {
    try {
      // Query platform revenue for the period
      const revenueQuery = query(
        collection(db, 'platform_revenue'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );

      const revenueSnapshot = await getDocs(revenueQuery);
      const revenueRecords = revenueSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: data.amount || 0,
          category: data.category,
          ownerId: data.ownerId,
          type: data.type,
          date: data.date?.toDate(),
        };
      });

      // Calculate totals
      const totalRevenue = revenueRecords.reduce((sum, record) => sum + record.amount, 0);
      const totalTransactions = revenueRecords.length;
      const averageCommission = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Category breakdown
      const categoryMap = new Map();
      const userMap = new Map();
      const revenueBreakdown = {
        commissions: 0,
        processingFees: 0,
        subscriptionFees: 0,
        boostFees: 0,
      };

      revenueRecords.forEach(record => {
        // Category stats
        if (record.category) {
          const categoryStats = categoryMap.get(record.category) || {
            category: record.category,
            revenue: 0,
            transactions: 0,
          };
          categoryStats.revenue += record.amount;
          categoryStats.transactions += 1;
          categoryMap.set(record.category, categoryStats);
        }

        // User stats
        if (record.ownerId) {
          const userStats = userMap.get(record.ownerId) || {
            userId: record.ownerId,
            displayName: '', // Would need to fetch from users collection
            revenue: 0,
            transactions: 0,
          };
          userStats.revenue += record.amount;
          userStats.transactions += 1;
          userMap.set(record.ownerId, userStats);
        }

        // Revenue breakdown
        switch (record.type) {
          case 'commission_revenue':
            revenueBreakdown.commissions += record.amount;
            break;
          case 'processing_fee':
            revenueBreakdown.processingFees += record.amount;
            break;
          case 'subscription_fee':
            revenueBreakdown.subscriptionFees += record.amount;
            break;
          case 'boost_fee':
            revenueBreakdown.boostFees += record.amount;
            break;
        }
      });

      // Sort and limit top categories and users
      const topCategories = Array.from(categoryMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const topUsers = Array.from(userMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        period,
        startDate,
        endDate,
        totalRevenue,
        totalTransactions,
        averageCommission,
        topCategories,
        topUsers,
        revenueBreakdown,
      };
    } catch (error) {
      console.error('Error getting revenue analytics:', error);
      throw new Error('Failed to get revenue analytics');
    }
  }

  // Update commission configuration
  public async updateConfig(newConfig: Partial<CommissionConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...newConfig };
      
      // Save to database for persistence
      const configDoc = {
        config: this.config,
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'platform_config'), configDoc);
    } catch (error) {
      console.error('Error updating commission config:', error);
      throw new Error('Failed to update commission configuration');
    }
  }

  // Get commission preview for user (before listing)
  public async getCommissionPreview(
    ownerId: string,
    category: string,
    dailyRate: number,
    rentalDays: number
  ): Promise<{
    rentalAmount: number;
    commission: CommissionCalculation;
    userTier: string;
    nextTierBenefit?: {
      nextTier: string;
      rentalsNeeded: number;
      potentialSavings: number;
    };
  }> {
    try {
      const rentalAmount = dailyRate * rentalDays;
      const commission = await this.calculateCommission(rentalAmount, ownerId, category);
      const userTier = await this.getUserTier(ownerId);

      // Calculate next tier benefit
      const currentTierIndex = this.config.tierRates.findIndex(t => t.tier === userTier);
      let nextTierBenefit;

      if (currentTierIndex < this.config.tierRates.length - 1) {
        const nextTier = this.config.tierRates[currentTierIndex + 1];
        const currentRentals = await this.getUserCompletedRentals(ownerId);
        const rentalsNeeded = Math.max(0, nextTier.minRentals - currentRentals);
        
        const nextTierCommission = Math.round(rentalAmount * nextTier.commissionRate);
        const potentialSavings = commission.commissionAmount - nextTierCommission;

        nextTierBenefit = {
          nextTier: nextTier.tier,
          rentalsNeeded,
          potentialSavings: Math.max(0, potentialSavings),
        };
      }

      return {
        rentalAmount,
        commission,
        userTier,
        nextTierBenefit,
      };
    } catch (error) {
      console.error('Error getting commission preview:', error);
      throw new Error('Failed to get commission preview');
    }
  }

  // Helper method to get user's completed rentals count
  private async getUserCompletedRentals(ownerId: string): Promise<number> {
    try {
      const rentalsQuery = query(
        collection(db, collections.rentals),
        where('ownerId', '==', ownerId),
        where('status', '==', 'completed')
      );

      const snapshot = await getDocs(rentalsQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting completed rentals count:', error);
      return 0;
    }
  }

  // Get commission history for a user
  public async getUserCommissionHistory(
    ownerId: string,
    limit: number = 20
  ): Promise<Array<{
    id: string;
    rentalId: string;
    amount: number;
    ownerPayout: number;
    rate: number;
    tier: string;
    category: string;
    date: Date;
  }>> {
    try {
      console.log('Commission: Getting history for user:', ownerId);

      const commissionQuery = query(
        collection(db, 'commission_transactions'),
        where('ownerId', '==', ownerId),
        where('status', '==', 'completed')
        // Note: orderBy and limit removed due to Firestore indexing requirements
        // orderBy('processedAt', 'desc'),
        // limit(limit)
      );

      console.log('Commission: Executing query...');
      const snapshot = await getDocs(commissionQuery);
      console.log('Commission: Query successful, found', snapshot.size, 'transactions');

      return snapshot.docs.map(doc => ({
        id: doc.id,
        rentalId: doc.data().rentalId,
        amount: doc.data().amount,
        ownerPayout: doc.data().ownerPayout,
        rate: doc.data().commissionRate,
        tier: doc.data().tier,
        category: doc.data().category,
        date: doc.data().processedAt?.toDate() || new Date(),
      }));
    } catch (error) {
      console.error('Error getting user commission history:', error);

      // Check if it's a permission error
      if (error && typeof error === 'object' && 'message' in error &&
          typeof (error as any).message === 'string' &&
          (error as any).message.includes('Missing or insufficient permissions')) {
        console.log('Commission: Permission error - rules may still be propagating or no transactions exist yet');
        // Return empty array instead of throwing - this is expected for new users
        return [];
      }

      // For other errors, still return empty array to prevent crashes
      return [];
    }
  }

  // Get current configuration
  public getConfig(): CommissionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const commissionService = CommissionService.getInstance();

// Convenience hook
export const useCommission = () => {
  return {
    calculateCommission: commissionService.calculateCommission.bind(commissionService),
    processCommission: commissionService.processCommission.bind(commissionService),
    getRevenueAnalytics: commissionService.getRevenueAnalytics.bind(commissionService),
    updateConfig: commissionService.updateConfig.bind(commissionService),
    getCommissionPreview: commissionService.getCommissionPreview.bind(commissionService),
    getUserCommissionHistory: commissionService.getUserCommissionHistory.bind(commissionService),
    getConfig: commissionService.getConfig.bind(commissionService),
  };
};

export default commissionService;
