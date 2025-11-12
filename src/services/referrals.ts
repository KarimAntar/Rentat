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
  limit,
  increment
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { User } from '../types';

export interface ReferralProgram {
  id: string;
  name: string;
  type: 'standard' | 'seasonal' | 'vip';
  isActive: boolean;
  rewards: {
    referrer: {
      type: 'percentage' | 'fixed' | 'credit';
      amount: number; // cents or percentage
      description: string;
    };
    referee: {
      type: 'percentage' | 'fixed' | 'credit';
      amount: number; // cents or percentage
      description: string;
    };
  };
  conditions: {
    minRentalAmount?: number; // Minimum rental amount to trigger reward
    maxRewards?: number; // Maximum number of rewards per user
    expiryDays?: number; // Days until referral code expires
    newUsersOnly: boolean; // Only new users can be referred
    verificationRequired?: boolean; // Referee must verify account
    firstRentalOnly?: boolean; // Reward only on first rental
  };
  tiers?: Array<{
    threshold: number; // Number of successful referrals
    multiplier: number; // Reward multiplier
    bonus?: number; // Additional bonus amount
  }>;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralCode {
  id: string;
  code: string;
  userId: string; // Referrer
  programId: string;
  isActive: boolean;
  usageCount: number;
  maxUsage?: number;
  expiryDate?: Date;
  customMessage?: string;
  metadata?: {
    source?: string; // How the code was generated
    campaign?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Referral {
  id: string;
  referralCode: string;
  referrerId: string; // User who referred
  refereeId: string; // User who was referred
  programId: string;
  status: 'pending' | 'qualified' | 'rewarded' | 'expired' | 'cancelled';
  qualificationData?: {
    rentalId?: string;
    rentalAmount?: number;
    qualifiedAt?: Date;
    verificationCompleted?: boolean;
  };
  rewards: {
    referrer: {
      type: string;
      amount: number;
      status: 'pending' | 'granted' | 'failed';
      grantedAt?: Date;
      transactionId?: string;
    };
    referee: {
      type: string;
      amount: number;
      status: 'pending' | 'granted' | 'failed';
      grantedAt?: Date;
      transactionId?: string;
    };
  };
  metadata?: {
    tier?: number;
    multiplier?: number;
    bonusAmount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralStats {
  userId: string;
  totalReferrals: number;
  qualifiedReferrals: number;
  totalRewardsEarned: number;
  currentTier: number;
  nextTierThreshold: number;
  rewardsSummary: {
    cash: number;
    credits: number;
    totalValue: number;
  };
  monthlyStats: Array<{
    month: string; // YYYY-MM
    referrals: number;
    rewards: number;
  }>;
  topPerformingCodes: Array<{
    code: string;
    usage: number;
    rewards: number;
  }>;
}

export interface ReferralAnalytics {
  totalReferrals: number;
  qualificationRate: number;
  averageRewardValue: number;
  topReferrers: Array<{
    userId: string;
    userName: string;
    referrals: number;
    totalRewards: number;
  }>;
  programPerformance: Array<{
    programId: string;
    programName: string;
    referrals: number;
    qualificationRate: number;
    totalRewardsPaid: number;
    roi: number;
  }>;
  monthlyGrowth: Array<{
    month: string;
    newReferrals: number;
    qualifiedReferrals: number;
    rewardsPaid: number;
  }>;
}

export class ReferralService {
  private static instance: ReferralService;
  private programs: ReferralProgram[];

  private constructor() {
    // Default referral programs
    this.programs = [
      {
        id: 'standard',
        name: 'Standard Referral',
        type: 'standard',
        isActive: true,
        rewards: {
          referrer: {
            type: 'fixed',
            amount: 1000, // 100 EGP credit
            description: '100 EGP credit when friend completes first rental',
          },
          referee: {
            type: 'percentage',
            amount: 20, // 20% off
            description: '20% off your first rental',
          },
        },
        conditions: {
          minRentalAmount: 2500, // Minimum $25 rental
          maxRewards: 50, // Max 50 referrals per user
          expiryDays: 90, // Code expires in 90 days
          newUsersOnly: true,
          verificationRequired: true,
          firstRentalOnly: true,
        },
        startDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'vip',
        name: 'VIP Referral Program',
        type: 'vip',
        isActive: true,
        rewards: {
          referrer: {
            type: 'percentage',
            amount: 5, // 5% of rental value
            description: '5% of friend\'s rental value as credit',
          },
          referee: {
            type: 'fixed',
            amount: 2500, // $25 off
            description: '$25 off your first rental',
          },
        },
        conditions: {
          minRentalAmount: 5000, // Minimum $50 rental
          maxRewards: 100,
          expiryDays: 180,
          newUsersOnly: true,
          verificationRequired: true,
          firstRentalOnly: false, // Rewards on any rental
        },
        tiers: [
          { threshold: 5, multiplier: 1.2, bonus: 500 },
          { threshold: 10, multiplier: 1.5, bonus: 1000 },
          { threshold: 25, multiplier: 2.0, bonus: 2500 },
          { threshold: 50, multiplier: 3.0, bonus: 5000 },
        ],
        startDate: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'seasonal_spring',
        name: 'Spring Bonus Referral',
        type: 'seasonal',
        isActive: false, // Activate during spring season
        rewards: {
          referrer: {
            type: 'fixed',
            amount: 2000, // $20 credit
            description: '$20 credit + bonus rewards',
          },
          referee: {
            type: 'percentage',
            amount: 30, // 30% off
            description: '30% off your first rental',
          },
        },
        conditions: {
          minRentalAmount: 3000,
          maxRewards: 25,
          expiryDays: 30, // Shorter expiry for seasonal
          newUsersOnly: true,
          verificationRequired: true,
          firstRentalOnly: true,
        },
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-05-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  public static getInstance(): ReferralService {
    if (!ReferralService.instance) {
      ReferralService.instance = new ReferralService();
    }
    return ReferralService.instance;
  }

  // Get all active programs
  public getActivePrograms(): ReferralProgram[] {
    return this.programs.filter(program => program.isActive);
  }

  // Get specific program
  public getProgram(programId: string): ReferralProgram | null {
    return this.programs.find(program => program.id === programId) || null;
  }

  // Generate referral code for user
  public async generateReferralCode(
    userId: string,
    programId: string = 'standard',
    customCode?: string
  ): Promise<ReferralCode> {
    try {
      const program = this.getProgram(programId);
      if (!program || !program.isActive) {
        throw new Error('Program not available');
      }

      // Deactivate all existing codes for this user
      const existingCodesQuery = query(
        collection(db, 'referral_codes'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      const existingCodesSnapshot = await getDocs(existingCodesQuery);

      // Deactivate existing codes
      const deactivatePromises = existingCodesSnapshot.docs.map(codeDoc =>
        updateDoc(codeDoc.ref, {
          isActive: false,
          updatedAt: serverTimestamp(),
        })
      );
      await Promise.all(deactivatePromises);

      // Generate unique code
      let code = customCode;
      if (!code) {
        const userDoc = await getDoc(doc(db, collections.users, userId));
        const user = userDoc.data() as User;
        const firstLetter = user?.displayName?.charAt(0)?.toUpperCase() || 'U';
        // Generate 6-character random string (letters and numbers)
        const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
        code = `${firstLetter}${randomChars}`;
      }

      // Check if code already exists (very unlikely but check anyway)
      const existingCodeQuery = query(
        collection(db, 'referral_codes'),
        where('code', '==', code)
      );
      const existingSnapshot = await getDocs(existingCodeQuery);

      if (!existingSnapshot.empty) {
        // Generate new random code if collision
        const firstLetter = code.charAt(0);
        const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
        code = `${firstLetter}${randomChars}`;
      }

      // Calculate expiry date
      const expiryDate = program.conditions.expiryDays 
        ? new Date(Date.now() + program.conditions.expiryDays * 24 * 60 * 60 * 1000)
        : undefined;

      const codeData: Omit<ReferralCode, 'id'> = {
        code,
        userId,
        programId,
        isActive: true,
        usageCount: 0,
        maxUsage: program.conditions.maxRewards,
        expiryDate,
        metadata: {
          source: customCode ? 'custom' : 'auto_generated',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const codeRef = await addDoc(collection(db, 'referral_codes'), {
        ...codeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        id: codeRef.id,
        ...codeData,
      };
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw new Error('Failed to generate referral code');
    }
  }

  // Apply referral code during signup/first rental
  public async applyReferralCode(
    code: string,
    refereeId: string,
    rentalId?: string
  ): Promise<Referral> {
    try {
      // Find referral code
      const codeQuery = query(
        collection(db, 'referral_codes'),
        where('code', '==', code),
        where('isActive', '==', true)
      );
      
      const codeSnapshot = await getDocs(codeQuery);
      if (codeSnapshot.empty) {
        throw new Error('Invalid or expired referral code');
      }

      const codeDoc = codeSnapshot.docs[0];
      const referralCode = { id: codeDoc.id, ...codeDoc.data() } as ReferralCode;

      // Check expiry
      if (referralCode.expiryDate && new Date() > referralCode.expiryDate) {
        throw new Error('Referral code has expired');
      }

      // Check usage limit
      if (referralCode.maxUsage && referralCode.usageCount >= referralCode.maxUsage) {
        throw new Error('Referral code usage limit reached');
      }

      // Get program details
      const program = this.getProgram(referralCode.programId);
      if (!program || !program.isActive) {
        throw new Error('Referral program not active');
      }

      // Validate referee is new user (if required)
      if (program.conditions.newUsersOnly) {
        const refereeDoc = await getDoc(doc(db, collections.users, refereeId));
        const referee = refereeDoc.data() as User;
        
        if (!referee) {
          throw new Error('User not found');
        }

        // Check if user has made rentals before
        const previousRentalsQuery = query(
          collection(db, collections.rentals),
          where('renterId', '==', refereeId),
          limit(1)
        );
        const previousRentals = await getDocs(previousRentalsQuery);
        
        if (!previousRentals.empty && program.conditions.firstRentalOnly) {
          throw new Error('Referral code can only be used by new users');
        }
      }

      // Check if user already used a referral code
      const existingReferralQuery = query(
        collection(db, 'referrals'),
        where('refereeId', '==', refereeId),
        where('status', 'in', ['qualified', 'rewarded'])
      );
      const existingReferrals = await getDocs(existingReferralQuery);
      
      if (!existingReferrals.empty && program.conditions.firstRentalOnly) {
        throw new Error('User has already used a referral code');
      }

      // Create referral record
      const referralData: Omit<Referral, 'id'> = {
        referralCode: code,
        referrerId: referralCode.userId,
        refereeId,
        programId: referralCode.programId,
        status: 'pending',
        qualificationData: rentalId ? {
          rentalId,
          qualifiedAt: new Date(),
        } : undefined,
        rewards: {
          referrer: {
            type: program.rewards.referrer.type,
            amount: program.rewards.referrer.amount,
            status: 'pending',
          },
          referee: {
            type: program.rewards.referee.type,
            amount: program.rewards.referee.amount,
            status: 'pending',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const referralRef = await addDoc(collection(db, 'referrals'), {
        ...referralData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update code usage count
      await updateDoc(codeDoc.ref, {
        usageCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      return {
        id: referralRef.id,
        ...referralData,
      };
    } catch (error) {
      console.error('Error applying referral code:', error);
      throw new Error('Failed to apply referral code');
    }
  }

  // Qualify referral when conditions are met
  public async qualifyReferral(
    referralId: string,
    rentalId: string,
    rentalAmount: number
  ): Promise<void> {
    try {
      const referralDoc = await getDoc(doc(db, 'referrals', referralId));
      if (!referralDoc.exists()) {
        throw new Error('Referral not found');
      }

      const referral = referralDoc.data() as Referral;
      const program = this.getProgram(referral.programId);
      
      if (!program) {
        throw new Error('Program not found');
      }

      // Check if rental meets minimum amount
      if (program.conditions.minRentalAmount && rentalAmount < program.conditions.minRentalAmount) {
        throw new Error('Rental amount does not meet minimum requirement');
      }

      // Update referral status
      await updateDoc(referralDoc.ref, {
        status: 'qualified',
        'qualificationData.rentalId': rentalId,
        'qualificationData.rentalAmount': rentalAmount,
        'qualificationData.qualifiedAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Grant rewards
      await this.grantReferralRewards(referralId);
    } catch (error) {
      console.error('Error qualifying referral:', error);
      throw new Error('Failed to qualify referral');
    }
  }

  // Grant rewards for qualified referral
  public async grantReferralRewards(referralId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get referral
        const referralRef = doc(db, 'referrals', referralId);
        const referralDoc = await transaction.get(referralRef);
        
        if (!referralDoc.exists()) {
          throw new Error('Referral not found');
        }

        const referral = referralDoc.data() as Referral;
        const program = this.getProgram(referral.programId);
        
        if (!program) {
          throw new Error('Program not found');
        }

        // Check if already rewarded
        if (referral.status === 'rewarded') {
          return;
        }

        // Get referrer stats for tier calculation
        const referrerStats = await this.getUserReferralStats(referral.referrerId);
        let tierMultiplier = 1;
        let tierBonus = 0;

        if (program.tiers) {
          for (const tier of program.tiers) {
            if (referrerStats.qualifiedReferrals >= tier.threshold) {
              tierMultiplier = tier.multiplier;
              tierBonus = tier.bonus || 0;
            }
          }
        }

        // Calculate final reward amounts
        const referrerRewardBase = program.rewards.referrer.type === 'percentage' 
          ? (referral.qualificationData?.rentalAmount || 0) * (program.rewards.referrer.amount / 100)
          : program.rewards.referrer.amount;
        
        const referrerReward = Math.round(referrerRewardBase * tierMultiplier) + tierBonus;

        // Grant referrer reward
        const referrerTransactionDoc = {
          userId: referral.referrerId,
          type: 'referral_reward',
          amount: referrerReward,
          currency: 'usd',
          status: 'completed',
          description: `Referral reward for referring ${referral.refereeId}`,
          metadata: {
            referralId,
            programId: referral.programId,
            tierMultiplier,
            tierBonus,
            originalAmount: referrerRewardBase,
          },
          createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, collections.walletTransactions), referrerTransactionDoc);

        // Grant referee reward
        let refereeReward = program.rewards.referee.amount;
        if (program.rewards.referee.type === 'percentage') {
          refereeReward = (referral.qualificationData?.rentalAmount || 0) * (program.rewards.referee.amount / 100);
        }

        const refereeTransactionDoc = {
          userId: referral.refereeId,
          type: 'referral_reward',
          amount: refereeReward,
          currency: 'usd',
          status: 'completed',
          description: `Welcome bonus for using referral code ${referral.referralCode}`,
          metadata: {
            referralId,
            programId: referral.programId,
            type: 'referee_reward',
          },
          createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, collections.walletTransactions), refereeTransactionDoc);

        // Update user wallet balances
        const referrerRef = doc(db, collections.users, referral.referrerId);
        const refereeRef = doc(db, collections.users, referral.refereeId);

        transaction.update(referrerRef, {
          'wallet.balance': increment(referrerReward),
          'wallet.totalEarnings': increment(referrerReward),
          updatedAt: serverTimestamp(),
        });

        transaction.update(refereeRef, {
          'wallet.balance': increment(refereeReward),
          updatedAt: serverTimestamp(),
        });

        // Update referral status
        transaction.update(referralRef, {
          status: 'rewarded',
          'rewards.referrer.status': 'granted',
          'rewards.referrer.grantedAt': serverTimestamp(),
          'rewards.referrer.amount': referrerReward,
          'rewards.referee.status': 'granted',
          'rewards.referee.grantedAt': serverTimestamp(),
          'rewards.referee.amount': refereeReward,
          'metadata.tier': referrerStats.currentTier,
          'metadata.multiplier': tierMultiplier,
          'metadata.bonusAmount': tierBonus,
          updatedAt: serverTimestamp(),
        });

        // Create platform cost record
        const platformCostRecord = {
          type: 'referral_reward',
          source: 'user_acquisition',
          amount: referrerReward + refereeReward,
          referralId,
          programId: referral.programId,
          date: serverTimestamp(),
          metadata: {
            referrerReward,
            refereeReward,
            programName: program.name,
          },
        };

        await addDoc(collection(db, 'platform_costs'), platformCostRecord);
      });
    } catch (error) {
      console.error('Error granting referral rewards:', error);
      throw new Error('Failed to grant referral rewards');
    }
  }

  // Get user's referral statistics
  public async getUserReferralStats(userId: string): Promise<ReferralStats> {
    try {
      // Get all referrals by user
      const referralsQuery = query(
        collection(db, 'referrals'),
        where('referrerId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const referralsSnapshot = await getDocs(referralsQuery);
      const referrals = referralsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Referral[];

      // Calculate basic stats
      const totalReferrals = referrals.length;
      const qualifiedReferrals = referrals.filter(r => ['qualified', 'rewarded'].includes(r.status)).length;
      
      // Calculate total rewards
      let totalCash = 0;
      let totalCredits = 0;

      referrals.forEach(referral => {
        if (referral.status === 'rewarded') {
          const amount = referral.rewards.referrer.amount;
          if (referral.rewards.referrer.type === 'fixed') {
            totalCredits += amount;
          } else {
            totalCash += amount;
          }
        }
      });

      const totalRewardsEarned = totalCash + totalCredits;

      // Determine current tier
      const vipProgram = this.getProgram('vip');
      let currentTier = 0;
      let nextTierThreshold = 0;

      if (vipProgram?.tiers) {
        for (let i = 0; i < vipProgram.tiers.length; i++) {
          if (qualifiedReferrals >= vipProgram.tiers[i].threshold) {
            currentTier = i + 1;
          } else if (nextTierThreshold === 0) {
            nextTierThreshold = vipProgram.tiers[i].threshold;
            break;
          }
        }
        if (nextTierThreshold === 0 && vipProgram.tiers.length > 0) {
          nextTierThreshold = vipProgram.tiers[vipProgram.tiers.length - 1].threshold;
        }
      }

      // Calculate monthly stats
      const monthlyMap = new Map<string, { referrals: number; rewards: number }>();
      referrals.forEach(referral => {
        if (referral.createdAt) {
          const month = `${referral.createdAt.getFullYear()}-${(referral.createdAt.getMonth() + 1).toString().padStart(2, '0')}`;
          const current = monthlyMap.get(month) || { referrals: 0, rewards: 0 };
          current.referrals++;
          if (referral.status === 'rewarded') {
            current.rewards += referral.rewards.referrer.amount;
          }
          monthlyMap.set(month, current);
        }
      });

      const monthlyStats = Array.from(monthlyMap.entries()).map(([month, stats]) => ({
        month,
        ...stats,
      })).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);

      // Get user's referral codes performance
      const codesQuery = query(
        collection(db, 'referral_codes'),
        where('userId', '==', userId),
        orderBy('usageCount', 'desc'),
        limit(5)
      );

      const codesSnapshot = await getDocs(codesQuery);
      const topPerformingCodes = codesSnapshot.docs.map(doc => {
        const codeData = doc.data() as ReferralCode;
        const codeReferrals = referrals.filter(r => r.referralCode === codeData.code);
        const codeRewards = codeReferrals.reduce((sum, r) => {
          return sum + (r.status === 'rewarded' ? r.rewards.referrer.amount : 0);
        }, 0);

        return {
          code: codeData.code,
          usage: codeData.usageCount,
          rewards: codeRewards,
        };
      });

      return {
        userId,
        totalReferrals,
        qualifiedReferrals,
        totalRewardsEarned,
        currentTier,
        nextTierThreshold,
        rewardsSummary: {
          cash: totalCash,
          credits: totalCredits,
          totalValue: totalRewardsEarned,
        },
        monthlyStats,
        topPerformingCodes,
      };
    } catch (error) {
      console.error('Error getting user referral stats:', error);
      throw new Error('Failed to get user referral stats');
    }
  }

  // Get referral analytics
  public async getReferralAnalytics(): Promise<ReferralAnalytics> {
    try {
      // Get all referrals
      const referralsQuery = query(collection(db, 'referrals'));
      const referralsSnapshot = await getDocs(referralsQuery);
      const referrals = referralsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Referral[];

      const totalReferrals = referrals.length;
      const qualifiedReferrals = referrals.filter(r => ['qualified', 'rewarded'].includes(r.status));
      const qualificationRate = totalReferrals > 0 ? (qualifiedReferrals.length / totalReferrals) * 100 : 0;
      
      const totalRewardsPaid = referrals
        .filter(r => r.status === 'rewarded')
        .reduce((sum, r) => sum + r.rewards.referrer.amount + r.rewards.referee.amount, 0);

      const averageRewardValue = qualifiedReferrals.length > 0 ? totalRewardsPaid / qualifiedReferrals.length : 0;

      // Top referrers
      const referrerMap = new Map<string, { referrals: number; totalRewards: number }>();
      
      referrals.forEach(referral => {
        const current = referrerMap.get(referral.referrerId) || { referrals: 0, totalRewards: 0 };
        current.referrals++;
        if (referral.status === 'rewarded') {
          current.totalRewards += referral.rewards.referrer.amount;
        }
        referrerMap.set(referral.referrerId, current);
      });

      // Convert to array and get top 10
      const topReferrers = Array.from(referrerMap.entries())
        .map(([userId, stats]) => ({
          userId,
          userName: `User ${userId.substring(0, 8)}`, // Would fetch actual names in production
          ...stats,
        }))
        .sort((a, b) => b.totalRewards - a.totalRewards)
        .slice(0, 10);

      // Program performance
      const programMap = new Map<string, { referrals: number; qualified: number; totalPaid: number }>();
      
      referrals.forEach(referral => {
        const current = programMap.get(referral.programId) || { referrals: 0, qualified: 0, totalPaid: 0 };
        current.referrals++;
        if (['qualified', 'rewarded'].includes(referral.status)) {
          current.qualified++;
        }
        if (referral.status === 'rewarded') {
          current.totalPaid += referral.rewards.referrer.amount + referral.rewards.referee.amount;
        }
        programMap.set(referral.programId, current);
      });

      const programPerformance = Array.from(programMap.entries()).map(([programId, stats]) => {
        const program = this.getProgram(programId);
        const qualificationRate = stats.referrals > 0 ? (stats.qualified / stats.referrals) * 100 : 0;
        const avgRewardValue = stats.qualified > 0 ? stats.totalPaid / stats.qualified : 0;
        const roi = avgRewardValue > 0 ? ((stats.qualified * 100) - stats.totalPaid) / stats.totalPaid * 100 : 0; // Simplified ROI

        return {
          programId,
          programName: program?.name || 'Unknown',
          referrals: stats.referrals,
          qualificationRate,
          totalRewardsPaid: stats.totalPaid,
          roi,
        };
      });

      // Monthly growth
      const monthlyMap = new Map<string, { newReferrals: number; qualified: number; rewardsPaid: number }>();
      
      referrals.forEach(referral => {
        if (referral.createdAt) {
          const month = `${referral.createdAt.getFullYear()}-${(referral.createdAt.getMonth() + 1).toString().padStart(2, '0')}`;
          const current = monthlyMap.get(month) || { newReferrals: 0, qualified: 0, rewardsPaid: 0 };
          
          current.newReferrals++;
          if (['qualified', 'rewarded'].includes(referral.status)) {
            current.qualified++;
          }
          if (referral.status === 'rewarded') {
            current.rewardsPaid += referral.rewards.referrer.amount + referral.rewards.referee.amount;
          }
          
          monthlyMap.set(month, current);
        }
      });

      const monthlyGrowth = Array.from(monthlyMap.entries())
        .map(([month, stats]) => ({ 
          month, 
          newReferrals: stats.newReferrals,
          qualifiedReferrals: stats.qualified,
          rewardsPaid: stats.rewardsPaid
        }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12);

      return {
        totalReferrals,
        qualificationRate,
        averageRewardValue,
        topReferrers,
        programPerformance,
        monthlyGrowth,
      };
    } catch (error) {
      console.error('Error getting referral analytics:', error);
      throw new Error('Failed to get referral analytics');
    }
  }

  // Validate referral code
  public async validateReferralCode(code: string): Promise<{
    isValid: boolean;
    program?: ReferralProgram;
    referrer?: string;
    expiryDate?: Date;
    usageRemaining?: number;
    error?: string;
  }> {
    try {
      const codeQuery = query(
        collection(db, 'referral_codes'),
        where('code', '==', code),
        where('isActive', '==', true)
      );
      
      const codeSnapshot = await getDocs(codeQuery);
      
      if (codeSnapshot.empty) {
        return {
          isValid: false,
          error: 'Referral code not found',
        };
      }

      const codeDoc = codeSnapshot.docs[0];
      const referralCode = codeDoc.data() as ReferralCode;

      // Check expiry
      if (referralCode.expiryDate && new Date() > referralCode.expiryDate) {
        return {
          isValid: false,
          error: 'Referral code has expired',
        };
      }

      // Check usage limit
      const usageRemaining = referralCode.maxUsage ? referralCode.maxUsage - referralCode.usageCount : -1;
      if (referralCode.maxUsage && usageRemaining <= 0) {
        return {
          isValid: false,
          error: 'Referral code usage limit reached',
        };
      }

      const program = this.getProgram(referralCode.programId);
      if (!program || !program.isActive) {
        return {
          isValid: false,
          error: 'Referral program not active',
        };
      }

      return {
        isValid: true,
        program,
        referrer: referralCode.userId,
        expiryDate: referralCode.expiryDate,
        usageRemaining: usageRemaining === -1 ? undefined : usageRemaining,
      };
    } catch (error) {
      console.error('Error validating referral code:', error);
      return {
        isValid: false,
        error: 'Error validating referral code',
      };
    }
  }

  // Get user's referral codes
  public async getUserReferralCodes(userId: string): Promise<ReferralCode[]> {
    try {
      const codesQuery = query(
        collection(db, 'referral_codes'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const codesSnapshot = await getDocs(codesQuery);
      
      return codesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiryDate: doc.data().expiryDate?.toDate(),
      })) as ReferralCode[];
    } catch (error) {
      console.error('Error getting user referral codes:', error);
      return [];
    }
  }
}

// Export singleton instance
export const referralService = ReferralService.getInstance();

// Convenience hook
export const useReferrals = () => {
  return {
    getActivePrograms: referralService.getActivePrograms.bind(referralService),
    getProgram: referralService.getProgram.bind(referralService),
    generateReferralCode: referralService.generateReferralCode.bind(referralService),
    applyReferralCode: referralService.applyReferralCode.bind(referralService),
    qualifyReferral: referralService.qualifyReferral.bind(referralService),
    grantReferralRewards: referralService.grantReferralRewards.bind(referralService),
    getUserReferralStats: referralService.getUserReferralStats.bind(referralService),
    getReferralAnalytics: referralService.getReferralAnalytics.bind(referralService),
    validateReferralCode: referralService.validateReferralCode.bind(referralService),
    getUserReferralCodes: referralService.getUserReferralCodes.bind(referralService),
  };
};

export default referralService;
