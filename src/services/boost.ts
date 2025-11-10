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
  runTransaction,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { Item, User } from '../types';
import paymentsService from './payments';

export interface BoostPackage {
  id: string;
  name: string;
  type: 'featured' | 'priority' | 'premium' | 'spotlight';
  duration: number; // in days
  price: number; // in cents
  benefits: string[];
  description: string;
  popular?: boolean;
  searchBoost: number; // multiplier for search ranking
  visibilityBoost: number; // multiplier for visibility
  badge?: {
    text: string;
    color: string;
    icon: string;
  };
}

export interface BoostTransaction {
  id: string;
  itemId: string;
  ownerId: string;
  packageId: string;
  packageType: string;
  amount: number; // in cents
  duration: number; // in days
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  paymentIntentId?: string;
  benefits: string[];
  searchBoost: number;
  visibilityBoost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoostAnalytics {
  totalSpent: number;
  totalBoosts: number;
  averageBoostDuration: number;
  performanceMetrics: {
    viewsIncrease: number;
    inquiriesIncrease: number;
    bookingsIncrease: number;
    revenueIncrease: number;
  };
  popularPackages: Array<{
    packageId: string;
    name: string;
    usage: number;
    revenue: number;
  }>;
}

export class BoostService {
  private static instance: BoostService;
  private packages: BoostPackage[];

  private constructor() {
    // Default boost packages
    this.packages = [
      {
        id: 'featured_3d',
        name: 'Featured Listing',
        type: 'featured',
        duration: 3,
        price: 500, // $5.00
        benefits: [
          'Priority placement in search results',
          'Featured badge on your listing',
          '2x visibility in search',
          'Highlighted in category browsing',
        ],
        description: 'Get your item noticed with premium placement for 3 days',
        searchBoost: 2.0,
        visibilityBoost: 2.0,
        badge: {
          text: 'Featured',
          color: '#F59E0B',
          icon: 'star',
        },
      },
      {
        id: 'priority_7d',
        name: 'Priority Boost',
        type: 'priority',
        duration: 7,
        price: 1000, // $10.00
        benefits: [
          'Top 5 placement in search results',
          'Priority badge on your listing',
          '3x visibility boost',
          'Email newsletter inclusion',
          'Social media feature consideration',
        ],
        description: 'Maximum visibility with top placement for a full week',
        popular: true,
        searchBoost: 3.0,
        visibilityBoost: 3.0,
        badge: {
          text: 'Priority',
          color: '#EF4444',
          icon: 'flash',
        },
      },
      {
        id: 'premium_14d',
        name: 'Premium Spotlight',
        type: 'premium',
        duration: 14,
        price: 2000, // $20.00
        benefits: [
          'Homepage featured section',
          'Guaranteed top 3 placement',
          '4x visibility boost',
          'Premium badge and styling',
          'Email newsletter feature',
          'Social media promotion',
          'Detailed performance analytics',
        ],
        description: 'Ultimate promotion package with premium placement for 2 weeks',
        searchBoost: 4.0,
        visibilityBoost: 4.0,
        badge: {
          text: 'Premium',
          color: '#8B5CF6',
          icon: 'diamond',
        },
      },
      {
        id: 'spotlight_1d',
        name: 'Quick Spotlight',
        type: 'spotlight',
        duration: 1,
        price: 200, // $2.00
        benefits: [
          'Same-day featured placement',
          'Spotlight badge',
          '1.5x visibility boost',
          'Perfect for urgent rentals',
        ],
        description: 'Quick boost for immediate visibility',
        searchBoost: 1.5,
        visibilityBoost: 1.5,
        badge: {
          text: 'Spotlight',
          color: '#10B981',
          icon: 'bulb',
        },
      },
    ];
  }

  public static getInstance(): BoostService {
    if (!BoostService.instance) {
      BoostService.instance = new BoostService();
    }
    return BoostService.instance;
  }

  // Get all available boost packages
  public getBoostPackages(): BoostPackage[] {
    return [...this.packages];
  }

  // Get specific boost package
  public getBoostPackage(packageId: string): BoostPackage | null {
    return this.packages.find(pkg => pkg.id === packageId) || null;
  }

  // Purchase boost for an item
  public async purchaseBoost(
    itemId: string,
    ownerId: string,
    packageId: string,
    paymentMethodId: string
  ): Promise<BoostTransaction> {
    try {
      const boostPackage = this.getBoostPackage(packageId);
      
      if (!boostPackage) {
        throw new Error('Invalid boost package');
      }

      // Verify item ownership
      const itemDoc = await getDoc(doc(db, collections.items, itemId));
      
      if (!itemDoc.exists()) {
        throw new Error('Item not found');
      }

      const item = itemDoc.data() as Item;
      
      if (item.ownerId !== ownerId) {
        throw new Error('You can only boost your own items');
      }

      // Check for existing active boost
      const existingBoost = await this.getActiveBoost(itemId);
      
      if (existingBoost) {
        throw new Error('Item already has an active boost. Please wait for it to expire or upgrade.');
      }

      // Process payment
      const paymentResult = await paymentsService.processPayment({
        amount: boostPackage.price,
        currency: 'usd',
        paymentMethodId,
        description: `Boost listing: ${boostPackage.name}`,
        metadata: {
          type: 'boost_payment',
          itemId,
          ownerId,
          packageId,
        },
      });

      if (paymentResult.status !== 'succeeded') {
        throw new Error('Payment failed');
      }

      // Create boost transaction
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + boostPackage.duration * 24 * 60 * 60 * 1000);

      const boostTransaction: Omit<BoostTransaction, 'id'> = {
        itemId,
        ownerId,
        packageId: boostPackage.id,
        packageType: boostPackage.type,
        amount: boostPackage.price,
        duration: boostPackage.duration,
        status: 'active',
        startDate,
        endDate,
        paymentIntentId: paymentResult.id,
        benefits: boostPackage.benefits,
        searchBoost: boostPackage.searchBoost,
        visibilityBoost: boostPackage.visibilityBoost,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save boost transaction
      const boostRef = await addDoc(collection(db, 'boost_transactions'), {
        ...boostTransaction,
        startDate: serverTimestamp(),
        endDate: new Date(Date.now() + boostPackage.duration * 24 * 60 * 60 * 1000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update item with boost information
      await updateDoc(doc(db, collections.items, itemId), {
        boost: {
          isActive: true,
          packageId: boostPackage.id,
          packageType: boostPackage.type,
          startDate: serverTimestamp(),
          endDate: new Date(Date.now() + boostPackage.duration * 24 * 60 * 60 * 1000),
          searchBoost: boostPackage.searchBoost,
          visibilityBoost: boostPackage.visibilityBoost,
          badge: boostPackage.badge,
          transactionId: boostRef.id,
        },
        updatedAt: serverTimestamp(),
      });

      // Create platform revenue record
      const revenueRecord = {
        type: 'boost_fee',
        source: 'listing_boost',
        amount: boostPackage.price,
        itemId,
        ownerId,
        packageId: boostPackage.id,
        packageType: boostPackage.type,
        date: serverTimestamp(),
        metadata: {
          duration: boostPackage.duration,
          searchBoost: boostPackage.searchBoost,
          visibilityBoost: boostPackage.visibilityBoost,
        },
      };

      await addDoc(collection(db, 'platform_revenue'), revenueRecord);

      return {
        id: boostRef.id,
        ...boostTransaction,
      };
    } catch (error) {
      console.error('Error purchasing boost:', error);
      throw new Error('Failed to purchase boost');
    }
  }

  // Get active boost for an item
  public async getActiveBoost(itemId: string): Promise<BoostTransaction | null> {
    try {
      const now = new Date();
      const boostQuery = query(
        collection(db, 'boost_transactions'),
        where('itemId', '==', itemId),
        where('status', '==', 'active'),
        where('endDate', '>', now),
        orderBy('endDate', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(boostQuery);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as BoostTransaction;
    } catch (error) {
      console.error('Error getting active boost:', error);
      return null;
    }
  }

  // Get boost history for a user
  public async getUserBoostHistory(
    ownerId: string,
    limitValue: number = 20
  ): Promise<BoostTransaction[]> {
    try {
      const boostQuery = query(
        collection(db, 'boost_transactions'),
        where('ownerId', '==', ownerId),
        orderBy('createdAt', 'desc'),
        limit(limitValue)
      );

      const snapshot = await getDocs(boostQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as BoostTransaction[];
    } catch (error) {
      console.error('Error getting boost history:', error);
      return [];
    }
  }

  // Expire boost (called by scheduled function)
  public async expireBoost(transactionId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get boost transaction
        const boostRef = doc(db, 'boost_transactions', transactionId);
        const boostDoc = await transaction.get(boostRef);
        
        if (!boostDoc.exists()) {
          throw new Error('Boost transaction not found');
        }

        const boost = boostDoc.data() as BoostTransaction;

        // Update boost status
        transaction.update(boostRef, {
          status: 'expired',
          updatedAt: serverTimestamp(),
        });

        // Update item to remove boost
        const itemRef = doc(db, collections.items, boost.itemId);
        transaction.update(itemRef, {
          'boost.isActive': false,
          'boost.expiredAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('Error expiring boost:', error);
      throw new Error('Failed to expire boost');
    }
  }

  // Cancel active boost
  public async cancelBoost(transactionId: string, ownerId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get boost transaction
        const boostRef = doc(db, 'boost_transactions', transactionId);
        const boostDoc = await transaction.get(boostRef);
        
        if (!boostDoc.exists()) {
          throw new Error('Boost transaction not found');
        }

        const boost = boostDoc.data() as BoostTransaction;

        // Verify ownership
        if (boost.ownerId !== ownerId) {
          throw new Error('You can only cancel your own boosts');
        }

        if (boost.status !== 'active') {
          throw new Error('Only active boosts can be cancelled');
        }

        // Calculate refund amount (pro-rated based on remaining time)
        const now = new Date();
        const totalDuration = boost.endDate.getTime() - boost.startDate.getTime();
        const remainingTime = boost.endDate.getTime() - now.getTime();
        const refundRatio = Math.max(0, remainingTime / totalDuration);
        const refundAmount = Math.round(boost.amount * refundRatio);

        // Update boost status
        transaction.update(boostRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          refundAmount,
          updatedAt: serverTimestamp(),
        });

        // Update item to remove boost
        const itemRef = doc(db, collections.items, boost.itemId);
        transaction.update(itemRef, {
          'boost.isActive': false,
          'boost.cancelledAt': serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Process refund if applicable
        if (refundAmount > 50) { // Only refund if > $0.50
          // Create refund record (actual refund would be processed by payment service)
          const refundRecord = {
            type: 'boost_refund',
            transactionId,
            ownerId,
            itemId: boost.itemId,
            originalAmount: boost.amount,
            refundAmount,
            refundRatio,
            status: 'pending',
            createdAt: serverTimestamp(),
          };

          await addDoc(collection(db, 'refund_requests'), refundRecord);
        }
      });
    } catch (error) {
      console.error('Error cancelling boost:', error);
      throw new Error('Failed to cancel boost');
    }
  }

  // Upgrade existing boost
  public async upgradeBoost(
    currentTransactionId: string,
    newPackageId: string,
    paymentMethodId: string,
    ownerId: string
  ): Promise<BoostTransaction> {
    try {
      // Get current boost
      const currentBoostDoc = await getDoc(doc(db, 'boost_transactions', currentTransactionId));
      
      if (!currentBoostDoc.exists()) {
        throw new Error('Current boost not found');
      }

      const currentBoost = currentBoostDoc.data() as BoostTransaction;
      
      if (currentBoost.ownerId !== ownerId) {
        throw new Error('You can only upgrade your own boosts');
      }

      // Get new package
      const newPackage = this.getBoostPackage(newPackageId);
      
      if (!newPackage) {
        throw new Error('Invalid boost package');
      }

      // Calculate upgrade cost (pro-rated difference)
      const now = new Date();
      const remainingTime = currentBoost.endDate.getTime() - now.getTime();
      const remainingDays = remainingTime / (24 * 60 * 60 * 1000);
      
      const currentPackage = this.getBoostPackage(currentBoost.packageId);
      const currentDailyRate = currentPackage ? currentPackage.price / currentPackage.duration : 0;
      const newDailyRate = newPackage.price / newPackage.duration;
      
      const upgradeCost = Math.round((newDailyRate - currentDailyRate) * remainingDays);

      if (upgradeCost <= 0) {
        throw new Error('Cannot downgrade to a lower package');
      }

      // Process payment for upgrade
      const paymentResult = await paymentsService.processPayment({
        amount: upgradeCost,
        currency: 'usd',
        paymentMethodId,
        description: `Boost upgrade: ${newPackage.name}`,
        metadata: {
          type: 'boost_upgrade',
          itemId: currentBoost.itemId,
          ownerId,
          originalTransactionId: currentTransactionId,
          newPackageId,
        },
      });

      if (paymentResult.status !== 'succeeded') {
        throw new Error('Upgrade payment failed');
      }

      // Cancel current boost and create new one
      await this.expireBoost(currentTransactionId);

      // Create new boost with remaining time + new duration
      const newStartDate = now;
      const newEndDate = new Date(now.getTime() + newPackage.duration * 24 * 60 * 60 * 1000);

      const newBoostTransaction: Omit<BoostTransaction, 'id'> = {
        itemId: currentBoost.itemId,
        ownerId,
        packageId: newPackage.id,
        packageType: newPackage.type,
        amount: upgradeCost,
        duration: newPackage.duration,
        status: 'active',
        startDate: newStartDate,
        endDate: newEndDate,
        paymentIntentId: paymentResult.id,
        benefits: newPackage.benefits,
        searchBoost: newPackage.searchBoost,
        visibilityBoost: newPackage.visibilityBoost,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newBoostRef = await addDoc(collection(db, 'boost_transactions'), {
        ...newBoostTransaction,
        startDate: serverTimestamp(),
        endDate: newEndDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update item with new boost information
      await updateDoc(doc(db, collections.items, currentBoost.itemId), {
        boost: {
          isActive: true,
          packageId: newPackage.id,
          packageType: newPackage.type,
          startDate: serverTimestamp(),
          endDate: newEndDate,
          searchBoost: newPackage.searchBoost,
          visibilityBoost: newPackage.visibilityBoost,
          badge: newPackage.badge,
          transactionId: newBoostRef.id,
          upgradedFrom: currentTransactionId,
        },
        updatedAt: serverTimestamp(),
      });

      return {
        id: newBoostRef.id,
        ...newBoostTransaction,
      };
    } catch (error) {
      console.error('Error upgrading boost:', error);
      throw new Error('Failed to upgrade boost');
    }
  }

  // Get boost analytics for a user
  public async getUserBoostAnalytics(ownerId: string): Promise<BoostAnalytics> {
    try {
      // Get all boost transactions for user
      const boostQuery = query(
        collection(db, 'boost_transactions'),
        where('ownerId', '==', ownerId)
      );

      const snapshot = await getDocs(boostQuery);
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as BoostTransaction[];

      // Calculate totals
      const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
      const totalBoosts = transactions.length;
      const averageBoostDuration = transactions.length > 0 
        ? transactions.reduce((sum, t) => sum + t.duration, 0) / transactions.length 
        : 0;

      // Package usage analysis
      const packageUsage = new Map<string, { count: number; revenue: number }>();
      transactions.forEach(t => {
        const current = packageUsage.get(t.packageId) || { count: 0, revenue: 0 };
        packageUsage.set(t.packageId, {
          count: current.count + 1,
          revenue: current.revenue + t.amount,
        });
      });

      const popularPackages = Array.from(packageUsage.entries()).map(([packageId, stats]) => {
        const pkg = this.getBoostPackage(packageId);
        return {
          packageId,
          name: pkg?.name || 'Unknown Package',
          usage: stats.count,
          revenue: stats.revenue,
        };
      }).sort((a, b) => b.usage - a.usage);

      // Performance metrics (would need actual analytics data in production)
      const performanceMetrics = {
        viewsIncrease: Math.floor(Math.random() * 200) + 100, // Mock data
        inquiriesIncrease: Math.floor(Math.random() * 150) + 50,
        bookingsIncrease: Math.floor(Math.random() * 100) + 25,
        revenueIncrease: Math.floor(Math.random() * 300) + 100,
      };

      return {
        totalSpent,
        totalBoosts,
        averageBoostDuration,
        performanceMetrics,
        popularPackages,
      };
    } catch (error) {
      console.error('Error getting boost analytics:', error);
      throw new Error('Failed to get boost analytics');
    }
  }

  // Get boost performance for an item
  public async getItemBoostPerformance(itemId: string): Promise<{
    totalBoosts: number;
    totalSpent: number;
    averagePerformanceIncrease: number;
    bestPerformingPackage?: string;
    recommendations: string[];
  }> {
    try {
      const boostQuery = query(
        collection(db, 'boost_transactions'),
        where('itemId', '==', itemId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(boostQuery);
      const boosts = snapshot.docs.map(doc => doc.data()) as BoostTransaction[];

      const totalBoosts = boosts.length;
      const totalSpent = boosts.reduce((sum, b) => sum + b.amount, 0);

      // Calculate average performance increase
      const averagePerformanceIncrease = boosts.length > 0 
        ? boosts.reduce((sum, b) => sum + (b.visibilityBoost - 1) * 100, 0) / boosts.length
        : 0;

      // Find best performing package
      const packagePerformance = new Map<string, number>();
      boosts.forEach(boost => {
        const current = packagePerformance.get(boost.packageType) || 0;
        packagePerformance.set(boost.packageType, current + boost.visibilityBoost);
      });

      const bestPerformingPackage = Array.from(packagePerformance.entries())
        .sort(([,a], [,b]) => b - a)[0]?.[0];

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (totalBoosts === 0) {
        recommendations.push('Try the Featured Listing package to start increasing visibility');
      } else if (totalBoosts < 3) {
        recommendations.push('Consider boosting during peak rental seasons');
        recommendations.push('Try different packages to find what works best');
      } else {
        if (bestPerformingPackage) {
          recommendations.push(`${bestPerformingPackage} packages work best for this item`);
        }
        recommendations.push('Regular boosting can maintain high visibility');
      }

      return {
        totalBoosts,
        totalSpent,
        averagePerformanceIncrease,
        bestPerformingPackage,
        recommendations,
      };
    } catch (error) {
      console.error('Error getting item boost performance:', error);
      throw new Error('Failed to get item boost performance');
    }
  }

  // Get recommended boost package for an item
  public getRecommendedBoost(
    item: Item,
    userHistory: BoostTransaction[]
  ): {
    packageId: string;
    reason: string;
    expectedIncrease: string;
  } {
    // Simple recommendation logic
    const hasBoostHistory = userHistory.length > 0;
    const itemAge = Date.now() - (item.createdAt?.getTime() || Date.now());
    const isNewItem = itemAge < 7 * 24 * 60 * 60 * 1000; // Less than 7 days old
    
    if (isNewItem) {
      return {
        packageId: 'featured_3d',
        reason: 'New listings benefit from initial visibility boost',
        expectedIncrease: '+150% visibility for first 3 days',
      };
    }

    if (!hasBoostHistory) {
      return {
        packageId: 'spotlight_1d',
        reason: 'Perfect starter boost to test performance',
        expectedIncrease: '+50% visibility for 1 day',
      };
    }

    // For experienced users, recommend popular package
    return {
      packageId: 'priority_7d',
      reason: 'Most popular choice with excellent ROI',
      expectedIncrease: '+200% visibility for 7 days',
    };
  }
}

// Export singleton instance
export const boostService = BoostService.getInstance();

// Convenience hook
export const useBoost = () => {
  return {
    getBoostPackages: boostService.getBoostPackages.bind(boostService),
    getBoostPackage: boostService.getBoostPackage.bind(boostService),
    purchaseBoost: boostService.purchaseBoost.bind(boostService),
    getActiveBoost: boostService.getActiveBoost.bind(boostService),
    getUserBoostHistory: boostService.getUserBoostHistory.bind(boostService),
    cancelBoost: boostService.cancelBoost.bind(boostService),
    upgradeBoost: boostService.upgradeBoost.bind(boostService),
    getUserBoostAnalytics: boostService.getUserBoostAnalytics.bind(boostService),
    getItemBoostPerformance: boostService.getItemBoostPerformance.bind(boostService),
    getRecommendedBoost: boostService.getRecommendedBoost.bind(boostService),
  };
};

export default boostService;
