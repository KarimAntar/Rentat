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
import { User } from '../types';
import paymentsService from './payments';

export interface SubscriptionTier {
  id: string;
  name: string;
  type: 'free' | 'basic' | 'pro' | 'enterprise';
  price: number; // Monthly price in cents
  yearlyPrice?: number; // Yearly price in cents (with discount)
  features: string[];
  limits: {
    maxListings: number;
    maxPhotosPerListing: number;
    maxVideoLength?: number; // in seconds
    prioritySupport: boolean;
    analyticsAccess: boolean;
    customBranding?: boolean;
    apiAccess?: boolean;
    advancedFilters: boolean;
    multiplePaymentMethods: boolean;
    bulkOperations?: boolean;
    earlyAccess?: boolean;
  };
  benefits: string[];
  popular?: boolean;
  badge?: {
    text: string;
    color: string;
  };
  trialDays?: number;
}

export interface UserSubscription {
  id: string;
  userId: string;
  tierId: string;
  tierType: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trial' | 'expired';
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  trialEndDate?: Date;
  autoRenew: boolean;
  stripeSubscriptionId?: string;
  paymentMethodId?: string;
  metadata?: {
    upgradeFrom?: string;
    downgradeFrom?: string;
    cancelReason?: string;
    promoCode?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  userId: string;
  tierId: string;
  period: string; // YYYY-MM format
  usage: {
    listingsCreated: number;
    photosUploaded: number;
    videosUploaded: number;
    apiCalls?: number;
    supportTickets?: number;
  };
  limits: {
    maxListings: number;
    maxPhotosPerListing: number;
    maxVideoLength?: number;
  };
  updatedAt: Date;
}

export interface SubscriptionAnalytics {
  totalSubscribers: number;
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
  tierDistribution: Array<{
    tierId: string;
    tierName: string;
    subscribers: number;
    revenue: number;
    percentage: number;
  }>;
  recentActivity: Array<{
    type: 'subscription' | 'upgrade' | 'downgrade' | 'cancellation';
    userId: string;
    tierFrom?: string;
    tierTo: string;
    amount: number;
    date: Date;
  }>;
}

export class SubscriptionService {
  private static instance: SubscriptionService;
  private tiers: SubscriptionTier[];

  private constructor() {
    // Default subscription tiers
    this.tiers = [
      {
        id: 'free',
        name: 'Free',
        type: 'free',
        price: 0,
        features: [
          'Up to 3 active listings',
          'Basic search visibility',
          'Standard customer support',
          '5 photos per listing',
          'Basic messaging',
        ],
        limits: {
          maxListings: 3,
          maxPhotosPerListing: 5,
          prioritySupport: false,
          analyticsAccess: false,
          advancedFilters: false,
          multiplePaymentMethods: false,
        },
        benefits: [
          'Perfect for getting started',
          'No monthly fees',
          'Access to basic features',
        ],
      },
      {
        id: 'basic',
        name: 'Basic',
        type: 'basic',
        price: 999, // $9.99/month
        yearlyPrice: 9990, // $99.90/year (2 months free)
        features: [
          'Up to 15 active listings',
          'Enhanced search visibility',
          'Priority customer support',
          '10 photos per listing',
          'Advanced messaging',
          'Basic analytics',
          'Multiple payment methods',
        ],
        limits: {
          maxListings: 15,
          maxPhotosPerListing: 10,
          prioritySupport: true,
          analyticsAccess: true,
          advancedFilters: false,
          multiplePaymentMethods: true,
        },
        benefits: [
          'Great for casual renters',
          '2 months free with yearly plan',
          'Enhanced visibility',
          'Basic analytics insights',
        ],
        trialDays: 7,
      },
      {
        id: 'pro',
        name: 'Professional',
        type: 'pro',
        price: 2999, // $29.99/month
        yearlyPrice: 29990, // $299.90/year (2 months free)
        features: [
          'Unlimited active listings',
          'Maximum search visibility',
          'Priority customer support',
          '25 photos per listing',
          '60-second videos per listing',
          'Advanced analytics & insights',
          'Multiple payment methods',
          'Advanced filtering options',
          'Bulk operations',
          'Custom listing templates',
        ],
        limits: {
          maxListings: -1, // Unlimited
          maxPhotosPerListing: 25,
          maxVideoLength: 60,
          prioritySupport: true,
          analyticsAccess: true,
          advancedFilters: true,
          multiplePaymentMethods: true,
          bulkOperations: true,
        },
        benefits: [
          'Perfect for power users',
          '2 months free with yearly plan',
          'Maximum visibility boost',
          'Advanced business tools',
          'Detailed analytics',
        ],
        popular: true,
        badge: {
          text: 'Most Popular',
          color: '#10B981',
        },
        trialDays: 14,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        type: 'enterprise',
        price: 9999, // $99.99/month
        yearlyPrice: 99990, // $999.90/year (2 months free)
        features: [
          'Unlimited active listings',
          'Premium search placement',
          'Dedicated account manager',
          'Unlimited photos per listing',
          'Unlimited video length',
          'Advanced analytics & insights',
          'Multiple payment methods',
          'Advanced filtering options',
          'Bulk operations',
          'Custom branding',
          'API access',
          'Early access to new features',
          'White-label options',
        ],
        limits: {
          maxListings: -1, // Unlimited
          maxPhotosPerListing: -1, // Unlimited
          maxVideoLength: -1, // Unlimited
          prioritySupport: true,
          analyticsAccess: true,
          customBranding: true,
          apiAccess: true,
          advancedFilters: true,
          multiplePaymentMethods: true,
          bulkOperations: true,
          earlyAccess: true,
        },
        benefits: [
          'For large-scale operations',
          '2 months free with yearly plan',
          'Dedicated support',
          'Custom solutions',
          'Full platform access',
        ],
        trialDays: 30,
      },
    ];
  }

  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  // Get all subscription tiers
  public getSubscriptionTiers(): SubscriptionTier[] {
    return [...this.tiers];
  }

  // Get specific subscription tier
  public getSubscriptionTier(tierId: string): SubscriptionTier | null {
    return this.tiers.find(tier => tier.id === tierId) || null;
  }

  // Get user's current subscription
  public async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const subscriptionQuery = query(
        collection(db, 'user_subscriptions'),
        where('userId', '==', userId),
        where('status', 'in', ['active', 'trial', 'past_due']),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(subscriptionQuery);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        trialEndDate: doc.data().trialEndDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as UserSubscription;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  }

  // Subscribe to a tier
  public async subscribe(
    userId: string,
    tierId: string,
    billingCycle: 'monthly' | 'yearly',
    paymentMethodId: string,
    promoCode?: string
  ): Promise<UserSubscription> {
    try {
      const tier = this.getSubscriptionTier(tierId);
      
      if (!tier) {
        throw new Error('Invalid subscription tier');
      }

      if (tier.type === 'free') {
        throw new Error('Cannot subscribe to free tier');
      }

      // Check for existing subscription
      const existingSubscription = await this.getUserSubscription(userId);
      
      if (existingSubscription) {
        throw new Error('User already has an active subscription. Use upgrade/downgrade instead.');
      }

      // Calculate pricing
      const amount = billingCycle === 'yearly' ? (tier.yearlyPrice || tier.price * 12) : tier.price;
      const trialDays = tier.trialDays || 0;
      
      let subscriptionData: Omit<UserSubscription, 'id'>;

      if (trialDays > 0) {
        // Start trial period
        const now = new Date();
        const trialEndDate = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
        
        subscriptionData = {
          userId,
          tierId: tier.id,
          tierType: tier.type,
          status: 'trial',
          billingCycle,
          amount,
          currency: 'usd',
          startDate: now,
          endDate: new Date(trialEndDate.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
          trialEndDate,
          autoRenew: true,
          paymentMethodId,
          metadata: {
            promoCode,
          },
          createdAt: now,
          updatedAt: now,
        };
      } else {
        // Process immediate payment
        const paymentResult = await paymentsService.processPayment({
          amount,
          currency: 'usd',
          paymentMethodId,
          description: `${tier.name} subscription (${billingCycle})`,
          metadata: {
            type: 'subscription_payment',
            userId,
            tierId,
            billingCycle,
            promoCode: promoCode || '',
          },
        });

        if (paymentResult.status !== 'succeeded') {
          throw new Error('Payment failed');
        }

        const now = new Date();
        const endDate = new Date(now.getTime() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

        subscriptionData = {
          userId,
          tierId: tier.id,
          tierType: tier.type,
          status: 'active',
          billingCycle,
          amount,
          currency: 'usd',
          startDate: now,
          endDate,
          autoRenew: true,
          paymentMethodId,
          metadata: {
            promoCode,
          },
          createdAt: now,
          updatedAt: now,
        };
      }

      // Save subscription
      const subscriptionRef = await addDoc(collection(db, 'user_subscriptions'), {
        ...subscriptionData,
        startDate: serverTimestamp(),
        endDate: subscriptionData.endDate,
        trialEndDate: subscriptionData.trialEndDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update user with subscription info
      await updateDoc(doc(db, collections.users, userId), {
        'subscription.currentTier': tier.id,
        'subscription.status': subscriptionData.status,
        'subscription.subscriptionId': subscriptionRef.id,
        updatedAt: serverTimestamp(),
      });

      // Create platform revenue record if not trial
      if (subscriptionData.status === 'active') {
        const revenueRecord = {
          type: 'subscription_fee',
          source: 'tier_subscription',
          amount,
          userId,
          tierId: tier.id,
          billingCycle,
          date: serverTimestamp(),
          metadata: {
            tierName: tier.name,
            tierType: tier.type,
          },
        };

        await addDoc(collection(db, 'platform_revenue'), revenueRecord);
      }

      return {
        id: subscriptionRef.id,
        ...subscriptionData,
      };
    } catch (error) {
      console.error('Error subscribing to tier:', error);
      throw new Error('Failed to subscribe to tier');
    }
  }

  // Upgrade/downgrade subscription
  public async changeSubscription(
    userId: string,
    newTierId: string,
    paymentMethodId?: string
  ): Promise<UserSubscription> {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      
      if (!currentSubscription) {
        throw new Error('No active subscription found');
      }

      const currentTier = this.getSubscriptionTier(currentSubscription.tierId);
      const newTier = this.getSubscriptionTier(newTierId);
      
      if (!currentTier || !newTier) {
        throw new Error('Invalid tier');
      }

      if (currentTier.id === newTier.id) {
        throw new Error('Already subscribed to this tier');
      }

      const isUpgrade = newTier.price > currentTier.price;
      const now = new Date();

      // Calculate prorated amounts
      const remainingTime = currentSubscription.endDate.getTime() - now.getTime();
      const totalBillingTime = currentSubscription.billingCycle === 'yearly' 
        ? 365 * 24 * 60 * 60 * 1000 
        : 30 * 24 * 60 * 60 * 1000;
      
      const usedRatio = 1 - (remainingTime / totalBillingTime);
      const newAmount = currentSubscription.billingCycle === 'yearly' 
        ? (newTier.yearlyPrice || newTier.price * 12) 
        : newTier.price;

      let prorationAmount = 0;

      if (isUpgrade) {
        // Calculate upgrade cost for remaining period
        const currentPeriodValue = currentSubscription.amount * (1 - usedRatio);
        const newPeriodValue = newAmount * (1 - usedRatio);
        prorationAmount = newPeriodValue - currentPeriodValue;
        
        if (prorationAmount > 0 && newTier.type !== 'free') {
          // Process upgrade payment
          const paymentResult = await paymentsService.processPayment({
            amount: Math.round(prorationAmount),
            currency: 'usd',
            paymentMethodId: paymentMethodId || currentSubscription.paymentMethodId || '',
            description: `Subscription upgrade: ${currentTier.name} to ${newTier.name}`,
            metadata: {
              type: 'subscription_upgrade',
              userId,
              fromTierId: currentTier.id,
              toTierId: newTier.id,
            },
          });

          if (paymentResult.status !== 'succeeded') {
            throw new Error('Upgrade payment failed');
          }
        }
      }

      // Update current subscription
      await runTransaction(db, async (transaction) => {
        const subscriptionRef = doc(db, 'user_subscriptions', currentSubscription.id);
        
        // Cancel current subscription
        transaction.update(subscriptionRef, {
          status: 'cancelled',
          metadata: {
            ...currentSubscription.metadata,
            [isUpgrade ? 'upgradeFrom' : 'downgradeFrom']: currentTier.id,
          },
          updatedAt: serverTimestamp(),
        });

        // Create new subscription
        const newSubscriptionData = {
          userId,
          tierId: newTier.id,
          tierType: newTier.type,
          status: newTier.type === 'free' ? 'active' : 'active',
          billingCycle: currentSubscription.billingCycle,
          amount: newAmount,
          currency: 'usd',
          startDate: now,
          endDate: currentSubscription.endDate, // Keep same end date
          autoRenew: newTier.type !== 'free',
          paymentMethodId: paymentMethodId || currentSubscription.paymentMethodId,
          metadata: {
            [isUpgrade ? 'upgradeFrom' : 'downgradeFrom']: currentTier.id,
          },
          createdAt: now,
          updatedAt: now,
        };

        const newSubscriptionRef = await addDoc(collection(db, 'user_subscriptions'), {
          ...newSubscriptionData,
          startDate: serverTimestamp(),
          endDate: currentSubscription.endDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update user subscription info
        const userRef = doc(db, collections.users, userId);
        transaction.update(userRef, {
          'subscription.currentTier': newTier.id,
          'subscription.status': newSubscriptionData.status,
          'subscription.subscriptionId': newSubscriptionRef.id,
          updatedAt: serverTimestamp(),
        });

        return {
          id: newSubscriptionRef.id,
          ...newSubscriptionData,
        };
      });

      // Create revenue record for upgrade
      if (isUpgrade && prorationAmount > 0) {
        const revenueRecord = {
          type: 'subscription_fee',
          source: 'tier_upgrade',
          amount: Math.round(prorationAmount),
          userId,
          tierId: newTier.id,
          date: serverTimestamp(),
          metadata: {
            fromTier: currentTier.name,
            toTier: newTier.name,
            prorationAmount: Math.round(prorationAmount),
          },
        };

        await addDoc(collection(db, 'platform_revenue'), revenueRecord);
      }

      return await this.getUserSubscription(userId) as UserSubscription;
    } catch (error) {
      console.error('Error changing subscription:', error);
      throw new Error('Failed to change subscription');
    }
  }

  // Cancel subscription
  public async cancelSubscription(
    userId: string,
    reason?: string,
    immediate: boolean = false
  ): Promise<void> {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const now = new Date();
      const endDate = immediate ? now : subscription.endDate;

      await runTransaction(db, async (transaction) => {
        const subscriptionRef = doc(db, 'user_subscriptions', subscription.id);
        
        transaction.update(subscriptionRef, {
          status: immediate ? 'cancelled' : 'cancelled',
          autoRenew: false,
          endDate: immediate ? serverTimestamp() : subscription.endDate,
          metadata: {
            ...subscription.metadata,
            cancelReason: reason,
            cancelledAt: serverTimestamp(),
            immediateCancel: immediate,
          },
          updatedAt: serverTimestamp(),
        });

        // Update user to free tier if immediate cancellation
        if (immediate) {
          const userRef = doc(db, collections.users, userId);
          transaction.update(userRef, {
            'subscription.currentTier': 'free',
            'subscription.status': 'cancelled',
            updatedAt: serverTimestamp(),
          });
        }
      });

      // Process refund for immediate cancellation if applicable
      if (immediate && subscription.status === 'active') {
        const remainingTime = subscription.endDate.getTime() - now.getTime();
        const totalTime = subscription.endDate.getTime() - subscription.startDate.getTime();
        const refundRatio = remainingTime / totalTime;
        const refundAmount = Math.round(subscription.amount * refundRatio);

        if (refundAmount > 100) { // Only refund if > $1.00
          const refundRecord = {
            type: 'subscription_refund',
            subscriptionId: subscription.id,
            userId,
            originalAmount: subscription.amount,
            refundAmount,
            refundRatio,
            reason: reason || 'Immediate cancellation',
            status: 'pending',
            createdAt: serverTimestamp(),
          };

          await addDoc(collection(db, 'refund_requests'), refundRecord);
        }
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Check and enforce subscription limits
  public async checkSubscriptionLimits(
    userId: string,
    action: 'create_listing' | 'upload_photo' | 'upload_video' | 'api_call'
  ): Promise<{
    allowed: boolean;
    limit: number;
    current: number;
    remaining: number;
    tier: string;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tier = this.getSubscriptionTier(subscription?.tierId || 'free');
      
      if (!tier) {
        throw new Error('Invalid subscription tier');
      }

      // Get current usage for the month
      const now = new Date();
      const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const usageQuery = query(
        collection(db, 'subscription_usage'),
        where('userId', '==', userId),
        where('period', '==', period)
      );

      const usageSnapshot = await getDocs(usageQuery);
      let usage: SubscriptionUsage | null = null;

      if (!usageSnapshot.empty) {
        const usageDoc = usageSnapshot.docs[0];
        usage = usageDoc.data() as SubscriptionUsage;
      }

      // Determine limits and current usage based on action
      let limit = 0;
      let current = 0;

      switch (action) {
        case 'create_listing':
          limit = tier.limits.maxListings;
          current = usage?.usage.listingsCreated || 0;
          break;
        case 'upload_photo':
          limit = tier.limits.maxPhotosPerListing;
          current = usage?.usage.photosUploaded || 0;
          break;
        case 'upload_video':
          limit = tier.limits.maxVideoLength || 0;
          current = usage?.usage.videosUploaded || 0;
          break;
        case 'api_call':
          limit = tier.limits.apiAccess ? 10000 : 0; // 10k API calls for API access
          current = usage?.usage.apiCalls || 0;
          break;
      }

      const unlimited = limit === -1;
      const allowed = unlimited || current < limit;
      const remaining = unlimited ? -1 : Math.max(0, limit - current);

      return {
        allowed,
        limit: unlimited ? -1 : limit,
        current,
        remaining,
        tier: tier.id,
      };
    } catch (error) {
      console.error('Error checking subscription limits:', error);
      return {
        allowed: false,
        limit: 0,
        current: 0,
        remaining: 0,
        tier: 'free',
      };
    }
  }

  // Update subscription usage
  public async updateSubscriptionUsage(
    userId: string,
    action: 'create_listing' | 'upload_photo' | 'upload_video' | 'api_call',
    amount: number = 1
  ): Promise<void> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tier = this.getSubscriptionTier(subscription?.tierId || 'free');
      
      if (!tier) {
        return;
      }

      const now = new Date();
      const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      const usageQuery = query(
        collection(db, 'subscription_usage'),
        where('userId', '==', userId),
        where('period', '==', period)
      );

      const usageSnapshot = await getDocs(usageQuery);

      if (usageSnapshot.empty) {
        // Create new usage record
        const usageData: SubscriptionUsage = {
          userId,
          tierId: tier.id,
          period,
          usage: {
            listingsCreated: action === 'create_listing' ? amount : 0,
            photosUploaded: action === 'upload_photo' ? amount : 0,
            videosUploaded: action === 'upload_video' ? amount : 0,
            apiCalls: action === 'api_call' ? amount : 0,
          },
          limits: tier.limits,
          updatedAt: now,
        };

        await addDoc(collection(db, 'subscription_usage'), {
          ...usageData,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Update existing usage record
        const usageDoc = usageSnapshot.docs[0];
        const currentUsage = usageDoc.data() as SubscriptionUsage;

        const updateField = `usage.${
          action === 'create_listing' ? 'listingsCreated' :
          action === 'upload_photo' ? 'photosUploaded' :
          action === 'upload_video' ? 'videosUploaded' :
          'apiCalls'
        }`;

        const currentValue = action === 'create_listing' ? currentUsage.usage.listingsCreated :
                           action === 'upload_photo' ? currentUsage.usage.photosUploaded :
                           action === 'upload_video' ? currentUsage.usage.videosUploaded :
                           currentUsage.usage.apiCalls || 0;

        await updateDoc(usageDoc.ref, {
          [updateField]: currentValue + amount,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating subscription usage:', error);
    }
  }

  // Get subscription analytics
  public async getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
    try {
      // Get all active subscriptions
      const subscriptionsQuery = query(
        collection(db, 'user_subscriptions'),
        where('status', 'in', ['active', 'trial'])
      );

      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      const subscriptions = subscriptionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as UserSubscription[];

      // Calculate metrics
      const totalSubscribers = subscriptions.length;
      const totalRevenue = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
      const monthlyRevenue = subscriptions
        .filter(sub => sub.billingCycle === 'monthly')
        .reduce((sum, sub) => sum + sub.amount, 0);
      const yearlyRevenue = subscriptions
        .filter(sub => sub.billingCycle === 'yearly')
        .reduce((sum, sub) => sum + sub.amount / 12, 0); // Convert to monthly equivalent

      const monthlyRecurringRevenue = monthlyRevenue + yearlyRevenue;
      const averageRevenuePerUser = totalSubscribers > 0 ? monthlyRecurringRevenue / totalSubscribers : 0;

      // Calculate tier distribution
      const tierMap = new Map<string, { subscribers: number; revenue: number }>();
      
      subscriptions.forEach(sub => {
        const current = tierMap.get(sub.tierId) || { subscribers: 0, revenue: 0 };
        const monthlyRevenue = sub.billingCycle === 'yearly' ? sub.amount / 12 : sub.amount;
        
        tierMap.set(sub.tierId, {
          subscribers: current.subscribers + 1,
          revenue: current.revenue + monthlyRevenue,
        });
      });

      const tierDistribution = Array.from(tierMap.entries()).map(([tierId, stats]) => {
        const tier = this.getSubscriptionTier(tierId);
        return {
          tierId,
          tierName: tier?.name || 'Unknown',
          subscribers: stats.subscribers,
          revenue: stats.revenue,
          percentage: totalSubscribers > 0 ? (stats.subscribers / totalSubscribers) * 100 : 0,
        };
      });

      // Mock churn rate calculation (would need historical data in production)
      const churnRate = Math.random() * 10; // 0-10% mock churn rate

      // Get recent activity (simplified)
      const recentActivity = subscriptions
        .slice(0, 10)
        .map(sub => ({
          type: 'subscription' as const,
          userId: sub.userId,
          tierTo: sub.tierId,
          amount: sub.amount,
          date: sub.createdAt,
        }));

      return {
        totalSubscribers,
        totalRevenue,
        monthlyRecurringRevenue,
        churnRate,
        averageRevenuePerUser,
        tierDistribution,
        recentActivity,
      };
    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw new Error('Failed to get subscription analytics');
    }
  }

  // Get user's subscription status and features
  public async getUserSubscriptionStatus(userId: string): Promise<{
    tier: SubscriptionTier;
    subscription: UserSubscription | null;
    usage: SubscriptionUsage | null;
    features: string[];
    limits: any;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tier = this.getSubscriptionTier(subscription?.tierId || 'free')!;

      // Get current usage
      const now = new Date();
      const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const usageQuery = query(
        collection(db, 'subscription_usage'),
        where('userId', '==', userId),
        where('period', '==', period)
      );

      const usageSnapshot = await getDocs(usageQuery);
      let usage: SubscriptionUsage | null = null;

      if (!usageSnapshot.empty) {
        const usageDoc = usageSnapshot.docs[0];
        usage = usageDoc.data() as SubscriptionUsage;
      }

      return {
        tier,
        subscription,
        usage,
        features: tier.features,
        limits: tier.limits,
      };
    } catch (error) {
      console.error('Error getting user subscription status:', error);
      throw new Error('Failed to get user subscription status');
    }
  }
}

// Export singleton instance
export const subscriptionService = SubscriptionService.getInstance();

// Convenience hook
export const useSubscriptions = () => {
  return {
    getSubscriptionTiers: subscriptionService.getSubscriptionTiers.bind(subscriptionService),
    getSubscriptionTier: subscriptionService.getSubscriptionTier.bind(subscriptionService),
    getUserSubscription: subscriptionService.getUserSubscription.bind(subscriptionService),
    subscribe: subscriptionService.subscribe.bind(subscriptionService),
    changeSubscription: subscriptionService.changeSubscription.bind(subscriptionService),
    cancelSubscription: subscriptionService.cancelSubscription.bind(subscriptionService),
    checkSubscriptionLimits: subscriptionService.checkSubscriptionLimits.bind(subscriptionService),
    updateSubscriptionUsage: subscriptionService.updateSubscriptionUsage.bind(subscriptionService),
    getSubscriptionAnalytics: subscriptionService.getSubscriptionAnalytics.bind(subscriptionService),
    getUserSubscriptionStatus: subscriptionService.getUserSubscriptionStatus.bind(subscriptionService),
  };
};

export default subscriptionService;
