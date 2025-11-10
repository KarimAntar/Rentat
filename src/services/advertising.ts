import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { subscriptionService } from './subscriptions';

export interface AdPlacement {
  id: string;
  name: string;
  type: 'banner' | 'native' | 'interstitial' | 'rewarded';
  position: 'header' | 'footer' | 'sidebar' | 'inline' | 'fullscreen';
  size: {
    width: number;
    height: number;
  };
  platforms: ('ios' | 'android')[];
  enabled: boolean;
  priority: number; // Higher priority ads show first
  targeting: {
    userTier?: string[]; // Free, basic, pro, enterprise
    userSegments?: string[]; // New users, power users, etc.
    locations?: string[]; // Governorates
    categories?: string[]; // Item categories
  };
  frequency: {
    impressionsPerUser: number; // Max impressions per user per day
    impressionsPerSession: number; // Max impressions per session
    cooldownMinutes: number; // Minutes between ad shows
  };
  revenue: {
    cpm: number; // Cost per thousand impressions
    cpc?: number; // Cost per click (for CPC ads)
    fillRate: number; // Expected fill rate (0-1)
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AdCampaign {
  id: string;
  name: string;
  advertiserId: string; // Could be platform or external advertiser
  type: 'house' | 'external'; // House ads vs external advertisers
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  placements: string[]; // Ad placement IDs this campaign can use
  budget: {
    total: number; // Total budget in cents
    spent: number; // Amount spent so far
    dailyLimit?: number; // Daily spending limit
    currency: string;
  };
  targeting: {
    userTier?: string[];
    userSegments?: string[];
    locations?: string[];
    categories?: string[];
    minAge?: number;
    maxAge?: number;
    languages?: string[];
  };
  schedule: {
    startDate: Date;
    endDate?: Date;
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    timeRanges?: Array<{
      start: string; // HH:MM format
      end: string; // HH:MM format
    }>;
  };
  creative: {
    type: 'image' | 'video' | 'html' | 'text';
    assets: {
      imageUrl?: string;
      videoUrl?: string;
      htmlContent?: string;
      title?: string;
      description?: string;
      callToAction?: string;
    };
    clickUrl?: string; // Where to redirect on click
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number; // Click-through rate
    cpm: number; // Effective CPM
    cpc?: number; // Effective CPC
    revenue: number; // Revenue generated
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AdImpression {
  id: string;
  campaignId: string;
  placementId: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android';
  location?: string;
  userTier?: string;
  timestamp: Date;
  duration?: number; // How long ad was visible (seconds)
  interacted: boolean; // Did user interact with ad
  sessionId: string;
}

export interface AdClick {
  id: string;
  impressionId: string;
  campaignId: string;
  placementId: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android';
  timestamp: Date;
  clickUrl?: string;
  converted: boolean; // Did this lead to a conversion
  conversionType?: 'signup' | 'rental' | 'listing' | 'subscription';
  conversionValue?: number; // Value of conversion
}

export interface AdAnalytics {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  averageCTR: number;
  averageCPM: number;
  topPerformingCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    impressions: number;
    clicks: number;
    ctr: number;
    revenue: number;
  }>;
  revenueByPlacement: Array<{
    placementId: string;
    placementName: string;
    impressions: number;
    revenue: number;
  }>;
  performanceByPlatform: {
    ios: {
      impressions: number;
      clicks: number;
      ctr: number;
    };
    android: {
      impressions: number;
      clicks: number;
      ctr: number;
    };
  };
  dailyStats: Array<{
    date: string;
    impressions: number;
    clicks: number;
    revenue: number;
  }>;
}

export class AdvertisingService {
  private static instance: AdvertisingService;
  private adPlacements: AdPlacement[];

  private constructor() {
    // Default ad placements
    this.adPlacements = [
      {
        id: 'header_banner',
        name: 'Header Banner',
        type: 'banner',
        position: 'header',
        size: { width: 320, height: 50 },
        platforms: ['ios', 'android'],
        enabled: true,
        priority: 10,
        targeting: {},
        frequency: {
          impressionsPerUser: 5,
          impressionsPerSession: 2,
          cooldownMinutes: 30,
        },
        revenue: {
          cpm: 500, // $5 CPM
          fillRate: 0.7,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'search_results_native',
        name: 'Search Results Native Ad',
        type: 'native',
        position: 'inline',
        size: { width: 320, height: 100 },
        platforms: ['ios', 'android'],
        enabled: true,
        priority: 8,
        targeting: {
          userTier: ['free'],
        },
        frequency: {
          impressionsPerUser: 3,
          impressionsPerSession: 1,
          cooldownMinutes: 60,
        },
        revenue: {
          cpm: 800, // $8 CPM
          fillRate: 0.6,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'item_detail_banner',
        name: 'Item Detail Banner',
        type: 'banner',
        position: 'inline',
        size: { width: 300, height: 250 },
        platforms: ['ios', 'android'],
        enabled: true,
        priority: 6,
        targeting: {},
        frequency: {
          impressionsPerUser: 2,
          impressionsPerSession: 1,
          cooldownMinutes: 120,
        },
        revenue: {
          cpm: 600, // $6 CPM
          fillRate: 0.8,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  public static getInstance(): AdvertisingService {
    if (!AdvertisingService.instance) {
      AdvertisingService.instance = new AdvertisingService();
    }
    return AdvertisingService.instance;
  }

  // Get all ad placements
  public getAdPlacements(): AdPlacement[] {
    return [...this.adPlacements];
  }

  // Get enabled ad placements for a specific position
  public getEnabledPlacements(position: AdPlacement['position']): AdPlacement[] {
    return this.adPlacements.filter(placement =>
      placement.enabled &&
      placement.position === position
    );
  }

  // Get targeted ad for user
  public async getTargetedAd(
    userId: string,
    position: AdPlacement['position'],
    platform: 'ios' | 'android',
    options?: {
      category?: string;
      userTier?: string;
      location?: string;
    }
  ): Promise<AdCampaign | null> {
    try {
      // Get enabled placements for this position
      const placements = this.getEnabledPlacements(position).filter(p =>
        p.platforms.includes(platform)
      );

      if (placements.length === 0) {
        return null;
      }

      // Check frequency limits
      const canShowAd = await this.checkFrequencyLimits(userId, placements);
      if (!canShowAd) {
        return null;
      }

      // Get active campaigns for these placements
      const campaigns = await this.getActiveCampaigns(placements.map(p => p.id));

      if (campaigns.length === 0) {
        return null;
      }

      // Filter campaigns by targeting
      const targetedCampaigns = campaigns.filter(campaign =>
        this.matchesTargeting(campaign, options?.userTier, options?.location, options?.category)
      );

      if (targetedCampaigns.length === 0) {
        return null;
      }

      // Select campaign (could use more sophisticated logic)
      const selectedCampaign = targetedCampaigns[0];

      return selectedCampaign;
    } catch (error) {
      console.error('Error getting targeted ad:', error);
      return null;
    }
  }

  // Check if user can see ads based on frequency limits
  private async checkFrequencyLimits(userId: string, placements: AdPlacement[]): Promise<boolean> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const sessionStart = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      // Check daily limits
      const dailyImpressionsQuery = query(
        collection(db, 'ad_impressions'),
        where('userId', '==', userId),
        where('timestamp', '>=', Timestamp.fromDate(new Date(today))),
        orderBy('timestamp', 'desc')
      );

      const dailySnapshot = await getDocs(dailyImpressionsQuery);
      const dailyImpressions = dailySnapshot.size;

      // Check session limits
      const sessionImpressionsQuery = query(
        collection(db, 'ad_impressions'),
        where('userId', '==', userId),
        where('timestamp', '>=', Timestamp.fromDate(sessionStart)),
        orderBy('timestamp', 'desc')
      );

      const sessionSnapshot = await getDocs(sessionImpressionsQuery);
      const sessionImpressions = sessionSnapshot.size;

      // Check cooldown
      const lastImpression = dailySnapshot.docs[0];
      const lastImpressionTime = lastImpression?.data().timestamp?.toDate();
      const cooldownPassed = !lastImpressionTime ||
        (now.getTime() - lastImpressionTime.getTime()) > (30 * 60 * 1000); // 30 minutes

      const maxDailyImpressions = Math.max(...placements.map(p => p.frequency.impressionsPerUser));
      const maxSessionImpressions = Math.max(...placements.map(p => p.frequency.impressionsPerSession));

      return dailyImpressions < maxDailyImpressions &&
             sessionImpressions < maxSessionImpressions &&
             cooldownPassed;
    } catch (error) {
      console.error('Error checking frequency limits:', error);
      return false;
    }
  }

  // Get active campaigns for placements
  private async getActiveCampaigns(placementIds: string[]): Promise<AdCampaign[]> {
    try {
      const campaignsQuery = query(
        collection(db, 'ad_campaigns'),
        where('status', '==', 'active'),
        where('placements', 'array-contains-any', placementIds)
      );

      const snapshot = await getDocs(campaignsQuery);
      const campaigns: AdCampaign[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        campaigns.push({
          id: doc.id,
          ...data,
          schedule: {
            ...data.schedule,
            startDate: data.schedule.startDate?.toDate(),
            endDate: data.schedule.endDate?.toDate(),
          },
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as AdCampaign);
      }

      return campaigns.filter(campaign => this.isCampaignScheduled(campaign));
    } catch (error) {
      console.error('Error getting active campaigns:', error);
      return [];
    }
  }

  // Check if campaign matches user targeting
  private matchesTargeting(
    campaign: AdCampaign,
    userTier?: string,
    location?: string,
    category?: string
  ): boolean {
    const targeting = campaign.targeting;

    // Check user tier
    if (targeting.userTier && userTier && !targeting.userTier.includes(userTier)) {
      return false;
    }

    // Check location
    if (targeting.locations && location && !targeting.locations.includes(location)) {
      return false;
    }

    // Check category
    if (targeting.categories && category && !targeting.categories.includes(category)) {
      return false;
    }

    return true;
  }

  // Check if campaign is currently scheduled to run
  private isCampaignScheduled(campaign: AdCampaign): boolean {
    const now = new Date();
    const schedule = campaign.schedule;

    // Check date range
    if (now < schedule.startDate) return false;
    if (schedule.endDate && now > schedule.endDate) return false;

    // Check days of week
    if (schedule.daysOfWeek) {
      const dayOfWeek = now.getDay(); // 0 = Sunday
      if (!schedule.daysOfWeek.includes(dayOfWeek)) return false;
    }

    // Check time ranges
    if (schedule.timeRanges) {
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      const inTimeRange = schedule.timeRanges.some(range =>
        currentTime >= range.start && currentTime <= range.end
      );
      if (!inTimeRange) return false;
    }

    return true;
  }

  // Record ad impression
  public async recordImpression(
    campaignId: string,
    placementId: string,
    userId: string,
    deviceId: string,
    platform: 'ios' | 'android',
    sessionId: string,
    location?: string,
    userTier?: string,
    duration?: number
  ): Promise<void> {
    try {
      const impression: Omit<AdImpression, 'id'> = {
        campaignId,
        placementId,
        userId,
        deviceId,
        platform,
        location,
        userTier,
        timestamp: new Date(),
        duration,
        interacted: false,
        sessionId,
      };

      await addDoc(collection(db, 'ad_impressions'), {
        ...impression,
        timestamp: serverTimestamp(),
      });

      // Update campaign performance
      await this.updateCampaignPerformance(campaignId, 'impression');
    } catch (error) {
      console.error('Error recording impression:', error);
    }
  }

  // Record ad click
  public async recordClick(
    impressionId: string,
    campaignId: string,
    placementId: string,
    userId: string,
    deviceId: string,
    platform: 'ios' | 'android',
    clickUrl?: string
  ): Promise<void> {
    try {
      const click: Omit<AdClick, 'id'> = {
        impressionId,
        campaignId,
        placementId,
        userId,
        deviceId,
        platform,
        timestamp: new Date(),
        clickUrl,
        converted: false,
      };

      await addDoc(collection(db, 'ad_clicks'), {
        ...click,
        timestamp: serverTimestamp(),
      });

      // Update campaign performance
      await this.updateCampaignPerformance(campaignId, 'click');

      // Mark impression as interacted
      await updateDoc(doc(db, 'ad_impressions', impressionId), {
        interacted: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error recording click:', error);
    }
  }

  // Update campaign performance metrics
  private async updateCampaignPerformance(campaignId: string, type: 'impression' | 'click' | 'conversion'): Promise<void> {
    try {
      const campaignRef = doc(db, 'ad_campaigns', campaignId);
      const campaignDoc = await getDoc(campaignRef);

      if (!campaignDoc.exists()) return;

      const campaign = campaignDoc.data() as AdCampaign;
      const performance = campaign.performance;

      switch (type) {
        case 'impression':
          performance.impressions++;
          break;
        case 'click':
          performance.clicks++;
          break;
        case 'conversion':
          performance.conversions++;
          break;
      }

      // Recalculate derived metrics
      performance.ctr = performance.impressions > 0 ? (performance.clicks / performance.impressions) * 100 : 0;
      performance.cpm = performance.impressions > 0 ? (performance.revenue / performance.impressions) * 1000 : 0;
      if (performance.clicks > 0) {
        performance.cpc = performance.revenue / performance.clicks;
      }

      await updateDoc(campaignRef, {
        performance,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating campaign performance:', error);
    }
  }

  // Get advertising analytics
  public async getAdvertisingAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<AdAnalytics> {
    try {
      // Get impressions in date range
      const impressionsQuery = query(
        collection(db, 'ad_impressions'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );

      const impressionsSnapshot = await getDocs(impressionsQuery);
      const impressions = impressionsSnapshot.docs.map(doc => doc.data() as AdImpression);

      // Get clicks in date range
      const clicksQuery = query(
        collection(db, 'ad_clicks'),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );

      const clicksSnapshot = await getDocs(clicksQuery);
      const clicks = clicksSnapshot.docs.map(doc => doc.data() as AdClick);

      // Calculate totals
      const totalImpressions = impressions.length;
      const totalClicks = clicks.length;
      const totalConversions = clicks.filter(c => c.converted).length;

      // Mock revenue calculation (would integrate with actual ad network)
      const totalRevenue = totalImpressions * 0.005; // $0.005 per impression

      const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averageCPM = totalRevenue * 1000 / totalImpressions;

      // Get top performing campaigns (simplified)
      const campaignStats = new Map<string, { impressions: number; clicks: number; revenue: number }>();

      impressions.forEach(impression => {
        const stats = campaignStats.get(impression.campaignId) || { impressions: 0, clicks: 0, revenue: 0 };
        stats.impressions++;
        stats.revenue += 0.005; // Mock revenue per impression
        campaignStats.set(impression.campaignId, stats);
      });

      clicks.forEach(click => {
        const stats = campaignStats.get(click.campaignId);
        if (stats) {
          stats.clicks++;
        }
      });

      const topPerformingCampaigns = Array.from(campaignStats.entries())
        .map(([campaignId, stats]) => ({
          campaignId,
          campaignName: `Campaign ${campaignId.slice(0, 8)}`,
          impressions: stats.impressions,
          clicks: stats.clicks,
          ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Revenue by placement
      const placementStats = new Map<string, { impressions: number; revenue: number }>();

      impressions.forEach(impression => {
        const stats = placementStats.get(impression.placementId) || { impressions: 0, revenue: 0 };
        stats.impressions++;
        stats.revenue += 0.005;
        placementStats.set(impression.placementId, stats);
      });

      const revenueByPlacement = Array.from(placementStats.entries())
        .map(([placementId, stats]) => ({
          placementId,
          placementName: this.adPlacements.find(p => p.id === placementId)?.name || 'Unknown',
          impressions: stats.impressions,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Performance by platform
      const iosStats = impressions.filter(i => i.platform === 'ios');
      const androidStats = impressions.filter(i => i.platform === 'android');

      const iosClicks = clicks.filter(c => c.platform === 'ios').length;
      const androidClicks = clicks.filter(c => c.platform === 'android').length;

      const performanceByPlatform = {
        ios: {
          impressions: iosStats.length,
          clicks: iosClicks,
          ctr: iosStats.length > 0 ? (iosClicks / iosStats.length) * 100 : 0,
        },
        android: {
          impressions: androidStats.length,
          clicks: androidClicks,
          ctr: androidStats.length > 0 ? (androidClicks / androidStats.length) * 100 : 0,
        },
      };

      // Daily stats (simplified - would need proper date aggregation)
      const dailyStats = [
        {
          date: new Date().toISOString().split('T')[0],
          impressions: totalImpressions,
          clicks: totalClicks,
          revenue: totalRevenue,
        },
      ];

      return {
        totalImpressions,
        totalClicks,
        totalConversions,
        totalRevenue,
        averageCTR,
        averageCPM,
        topPerformingCampaigns,
        revenueByPlacement,
        performanceByPlatform,
        dailyStats,
      };
    } catch (error) {
      console.error('Error getting advertising analytics:', error);
      throw new Error('Failed to get advertising analytics');
    }
  }

  // Create a house ad campaign
  public async createHouseAdCampaign(
    name: string,
    placements: string[],
    creative: AdCampaign['creative'],
    budget: number,
    startDate: Date,
    endDate?: Date
  ): Promise<string> {
    try {
      const campaign: Omit<AdCampaign, 'id'> = {
        name,
        advertiserId: 'platform', // House ads
        type: 'house',
        status: 'active',
        placements,
        budget: {
          total: budget,
          spent: 0,
          currency: 'usd',
        },
        targeting: {},
        schedule: {
          startDate,
          endDate,
        },
        creative,
        performance: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          cpm: 0,
          revenue: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'ad_campaigns'), {
        ...campaign,
        schedule: {
          ...campaign.schedule,
          startDate: serverTimestamp(),
          endDate: endDate ? Timestamp.fromDate(endDate) : null,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating house ad campaign:', error);
      throw new Error('Failed to create ad campaign');
    }
  }

  // Check if user should see ads (based on subscription tier)
  public shouldShowAds(userTier?: string): boolean {
    // Free users see ads, paid users don't
    return userTier === 'free' || !userTier;
  }

  // Get user's ad-free status
  public async getUserAdFreeStatus(userId: string): Promise<boolean> {
    try {
      const subscription = await subscriptionService.getUserSubscription(userId);
      return subscription ? subscription.tierType !== 'free' : false;
    } catch (error) {
      console.error('Error checking user ad-free status:', error);
      return false;
    }
  }
}

// Export singleton instance
export const advertisingService = AdvertisingService.getInstance();

export default advertisingService;
