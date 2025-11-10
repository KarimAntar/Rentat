import { 
  doc, 
  updateDoc, 
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  startAfter
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { User, Review, Item, Rental, WalletTransaction } from '../types';
import { reviewService } from './reviews';
import { verificationService } from './verification';

export interface UserProfileStats {
  totalListings: number;
  activeListings: number;
  completedRentals: number;
  totalEarnings: number;
  averageRating: number;
  totalReviews: number;
  joinedDate: Date;
  responseRate: number;
  responseTime: string; // e.g., "within 2 hours"
  memberSince: string; // e.g., "2 years"
}

export interface UserBadge {
  id: string;
  type: 'verification' | 'achievement' | 'trust' | 'activity';
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedAt?: Date;
  criteria?: string;
}

export interface ProfileVisibility {
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showEarnings: boolean;
  showListings: boolean;
  showReviews: boolean;
}

export interface UserProfileData {
  user: User;
  stats: UserProfileStats;
  badges: UserBadge[];
  recentReviews: Review[];
  activeListings: Item[];
  completedRentals: Rental[];
  visibility: ProfileVisibility;
}

export class UserProfileService {
  private static instance: UserProfileService;

  private constructor() {}

  public static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  // Get comprehensive user profile data
  public async getUserProfile(userId: string, viewerId?: string): Promise<UserProfileData> {
    try {
      // Get basic user data
      const userDoc = await getDoc(doc(db, collections.users, userId));
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const user = {
        id: userDoc.id,
        ...userDoc.data(),
        createdAt: userDoc.data().createdAt?.toDate(),
        updatedAt: userDoc.data().updatedAt?.toDate(),
      } as any;

      // Get user statistics
      const stats = await this.getUserStats(userId);
      
      // Get user badges
      const badges = await this.getUserBadges(userId);
      
      // Get recent reviews
      const recentReviews = await this.getRecentReviews(userId, 5);
      
      // Get active listings
      const activeListings = await this.getActiveListings(userId, 6);
      
      // Get completed rentals (limited for privacy)
      const completedRentals = await this.getCompletedRentals(userId, viewerId, 3);

      // Get visibility settings
      const visibility = this.getVisibilitySettings(user, viewerId);

      return {
        user,
        stats,
        badges,
        recentReviews,
        activeListings,
        completedRentals,
        visibility,
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to get user profile');
    }
  }

  // Get user statistics
  public async getUserStats(userId: string): Promise<UserProfileStats> {
    try {
      const user = await this.getUser(userId);
      
      // Get listings count
      const listingsQuery = query(
        collection(db, collections.items),
        where('ownerId', '==', userId)
      );
      const listingsSnapshot = await getDocs(listingsQuery);
      const totalListings = listingsSnapshot.size;
      
      const activeListings = listingsSnapshot.docs.filter(
        doc => doc.data().status === 'active'
      ).length;

      // Get completed rentals count
      const rentalsQuery = query(
        collection(db, collections.rentals),
        where('ownerId', '==', userId),
        where('status', '==', 'completed')
      );
      const rentalsSnapshot = await getDocs(rentalsQuery);
      const completedRentals = rentalsSnapshot.size;

      // Calculate average rating and total reviews
      const { average: averageRating, count: totalReviews } = await reviewService.getReviewStats(userId, 'renter-to-owner');

      // Calculate response rate and time (mock data for MVP)
      const responseRate = this.calculateResponseRate(userId);
      const responseTime = this.calculateResponseTime(userId);

      return {
        totalListings,
        activeListings,
        completedRentals,
        totalEarnings: user.wallet?.totalEarnings || 0,
        averageRating,
        totalReviews,
        joinedDate: user.createdAt,
        responseRate,
        responseTime,
        memberSince: this.calculateMemberSince(user.createdAt),
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Failed to get user statistics');
    }
  }

  // Get user badges
  public async getUserBadges(userId: string): Promise<UserBadge[]> {
    try {
      const badges: UserBadge[] = [];
      const user = await this.getUser(userId);
      const stats = await this.getUserStats(userId);

      // Verification badges
      const verificationBadge = verificationService.getVerificationBadge(
        user.verification?.isVerified || false
      );
      
      if (verificationBadge.show) {
        badges.push({
          id: 'verified',
          type: 'verification',
          name: 'Identity Verified',
          description: 'Identity has been verified by Rentat',
          icon: 'checkmark-shield',
          color: '#10B981',
          earnedAt: user.verification?.verifiedAt,
        });
      }

      // Trust badges based on ratings
      if (stats.averageRating >= 4.8 && stats.totalReviews >= 10) {
        badges.push({
          id: 'superhost',
          type: 'trust',
          name: 'Superhost',
          description: 'Exceptional host with outstanding reviews',
          icon: 'star',
          color: '#F59E0B',
          criteria: '4.8+ rating with 10+ reviews',
        });
      } else if (stats.averageRating >= 4.5 && stats.totalReviews >= 5) {
        badges.push({
          id: 'trusted',
          type: 'trust',
          name: 'Trusted Member',
          description: 'Reliable member with great reviews',
          icon: 'shield-checkmark',
          color: '#3B82F6',
          criteria: '4.5+ rating with 5+ reviews',
        });
      }

      // Activity badges
      if (stats.completedRentals >= 50) {
        badges.push({
          id: 'veteran',
          type: 'activity',
          name: 'Veteran Renter',
          description: 'Experienced with 50+ completed rentals',
          icon: 'trophy',
          color: '#8B5CF6',
        });
      } else if (stats.completedRentals >= 10) {
        badges.push({
          id: 'experienced',
          type: 'activity',
          name: 'Experienced',
          description: 'Active member with multiple rentals',
          icon: 'ribbon',
          color: '#06B6D4',
        });
      }

      // Achievement badges
      if (stats.totalListings >= 10) {
        badges.push({
          id: 'entrepreneur',
          type: 'achievement',
          name: 'Entrepreneur',
          description: 'Active lender with multiple items',
          icon: 'briefcase',
          color: '#EF4444',
        });
      }

      // Response time badge
      if (stats.responseRate >= 95) {
        badges.push({
          id: 'responsive',
          type: 'trust',
          name: 'Super Responsive',
          description: 'Responds quickly to messages',
          icon: 'chatbubble-ellipses',
          color: '#10B981',
        });
      }

      return badges;
    } catch (error) {
      console.error('Error getting user badges:', error);
      return [];
    }
  }

  // Get recent reviews for user
  private async getRecentReviews(userId: string, limitValue: number = 5): Promise<Review[]> {
    try {
      const reviewsQuery = query(
        collection(db, collections.reviews),
        where('revieweeId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitValue)
      );

      const snapshot = await getDocs(reviewsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Review[];
    } catch (error) {
      console.error('Error getting recent reviews:', error);
      return [];
    }
  }

  // Get active listings
  private async getActiveListings(userId: string, limitValue: number = 6): Promise<Item[]> {
    try {
      const listingsQuery = query(
        collection(db, collections.items),
        where('ownerId', '==', userId),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(limitValue)
      );

      const snapshot = await getDocs(listingsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Item[];
    } catch (error) {
      console.error('Error getting active listings:', error);
      return [];
    }
  }

  // Get completed rentals (privacy-aware)
  private async getCompletedRentals(
    userId: string, 
    viewerId?: string, 
    limitValue: number = 3
  ): Promise<Rental[]> {
    try {
      // Only show completed rentals if viewing own profile or involved in rental
      if (!viewerId || viewerId !== userId) {
        return []; // Privacy protection
      }

      const rentalsQuery = query(
        collection(db, collections.rentals),
        where('ownerId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('updatedAt', 'desc'),
        limit(limitValue)
      );

      const snapshot = await getDocs(rentalsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Rental[];
    } catch (error) {
      console.error('Error getting completed rentals:', error);
      return [];
    }
  }

  // Get visibility settings based on privacy preferences
  private getVisibilitySettings(user: User, viewerId?: string): ProfileVisibility {
    const isOwnProfile = viewerId === user.uid;
    const defaultSettings = (user as any).privacy || {
      showEmail: false,
      showPhone: false,
      showLocation: true,
      showEarnings: false,
      showListings: true,
      showReviews: true,
    };

    return {
      showEmail: isOwnProfile || defaultSettings.showEmail,
      showPhone: isOwnProfile || defaultSettings.showPhone,
      showLocation: defaultSettings.showLocation,
      showEarnings: isOwnProfile || defaultSettings.showEarnings,
      showListings: defaultSettings.showListings,
      showReviews: defaultSettings.showReviews,
    };
  }

  // Update profile information
  public async updateProfile(
    userId: string, 
    updates: Partial<User>
  ): Promise<void> {
    try {
      const userRef = doc(db, collections.users, userId);
      
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error('Failed to update profile');
    }
  }

  // Update privacy settings
  public async updatePrivacySettings(
    userId: string,
    privacy: Partial<ProfileVisibility>
  ): Promise<void> {
    try {
      const userRef = doc(db, collections.users, userId);

      await updateDoc(userRef, {
        privacy,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw new Error('Failed to update privacy settings');
    }
  }

  // Favorites functionality
  public async addToFavorites(userId: string, itemId: string): Promise<void> {
    try {
      const userRef = doc(db, collections.users, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentFavorites = userData.favorites || [];

      if (!currentFavorites.includes(itemId)) {
        await updateDoc(userRef, {
          favorites: [...currentFavorites, itemId],
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw new Error('Failed to add to favorites');
    }
  }

  public async removeFromFavorites(userId: string, itemId: string): Promise<void> {
    try {
      const userRef = doc(db, collections.users, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentFavorites = userData.favorites || [];

      await updateDoc(userRef, {
        favorites: currentFavorites.filter((id: string) => id !== itemId),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw new Error('Failed to remove from favorites');
    }
  }

  public async getUserFavorites(userId: string): Promise<string[]> {
    try {
      const userDoc = await getDoc(doc(db, collections.users, userId));

      if (!userDoc.exists()) {
        return [];
      }

      const userData = userDoc.data();
      return userData.favorites || [];
    } catch (error) {
      console.error('Error getting user favorites:', error);
      return [];
    }
  }

  public async isItemFavorited(userId: string, itemId: string): Promise<boolean> {
    try {
      const favorites = await this.getUserFavorites(userId);
      return favorites.includes(itemId);
    } catch (error) {
      console.error('Error checking if item is favorited:', error);
      return false;
    }
  }

  // Search users by name or username
  public async searchUsers(
    searchTerm: string, 
    limitValue: number = 10
  ): Promise<User[]> {
    try {
      // Note: Firestore doesn't support full-text search
      // In production, you'd use Algolia or similar service
      
      const usersQuery = query(
        collection(db, collections.users),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(limitValue)
      );

      const snapshot = await getDocs(usersQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email,
          displayName: data.displayName,
          location: data.location,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as User;
      });
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  // Get user's rental history with pagination
  public async getUserRentalHistory(
    userId: string,
    type: 'as_owner' | 'as_renter' = 'as_owner',
    lastDoc?: any,
    limitValue: number = 10
  ): Promise<{ rentals: Rental[]; hasMore: boolean }> {
    try {
      const field = type === 'as_owner' ? 'ownerId' : 'renterId';
      
      let q = query(
        collection(db, collections.rentals),
        where(field, '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limitValue + 1) // Get one extra to check if there are more
      );

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      const hasMore = docs.length > limitValue;
      
      const rentals = docs.slice(0, limitValue).map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Rental[];

      return {
        rentals,
        hasMore,
      };
    } catch (error) {
      console.error('Error getting rental history:', error);
      return { rentals: [], hasMore: false };
    }
  }

  // Helper methods
  private async getUser(userId: string): Promise<User> {
    const userDoc = await getDoc(doc(db, collections.users, userId));
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const data = userDoc.data();
    return {
      uid: userDoc.id,
      email: data.email,
      displayName: data.displayName,
      location: data.location,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    } as User;
  }

  private calculateResponseRate(userId: string): number {
    // In a real implementation, this would calculate based on message response data
    // For MVP, return a mock value based on user activity
    return Math.floor(Math.random() * 20) + 80; // 80-100%
  }

  private calculateResponseTime(userId: string): string {
    // Mock response time calculation
    const times = [
      'within 1 hour',
      'within 2 hours',
      'within 4 hours',
      'within 1 day',
    ];
    
    return times[Math.floor(Math.random() * times.length)];
  }

  private calculateMemberSince(joinDate: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return 'New member';
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''}`;
    }
  }

  // Get trust score details
  public getTrustScoreDetails(stats: UserProfileStats): {
    score: number;
    factors: Array<{
      name: string;
      value: number;
      weight: number;
      description: string;
    }>;
  } {
    const factors = [
      {
        name: 'Average Rating',
        value: Math.min(stats.averageRating / 5, 1),
        weight: 0.3,
        description: `${stats.averageRating.toFixed(1)}/5.0 stars`,
      },
      {
        name: 'Review Count',
        value: Math.min(stats.totalReviews / 20, 1),
        weight: 0.2,
        description: `${stats.totalReviews} reviews`,
      },
      {
        name: 'Response Rate',
        value: stats.responseRate / 100,
        weight: 0.2,
        description: `${stats.responseRate}% response rate`,
      },
      {
        name: 'Experience',
        value: Math.min(stats.completedRentals / 10, 1),
        weight: 0.15,
        description: `${stats.completedRentals} completed rentals`,
      },
      {
        name: 'Account Age',
        value: Math.min(this.daysSinceJoin(stats.joinedDate) / 365, 1),
        weight: 0.15,
        description: `Member for ${stats.memberSince}`,
      },
    ];

    const score = Math.round(
      factors.reduce((total, factor) => {
        return total + (factor.value * factor.weight * 100);
      }, 0)
    );

    return {
      score: Math.min(score, 100),
      factors,
    };
  }

  private daysSinceJoin(joinDate: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - joinDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const userProfileService = UserProfileService.getInstance();

// Convenience hook
export const useUserProfile = () => {
  return {
    getUserProfile: userProfileService.getUserProfile.bind(userProfileService),
    getUserStats: userProfileService.getUserStats.bind(userProfileService),
    getUserBadges: userProfileService.getUserBadges.bind(userProfileService),
    updateProfile: userProfileService.updateProfile.bind(userProfileService),
    updatePrivacySettings: userProfileService.updatePrivacySettings.bind(userProfileService),
    searchUsers: userProfileService.searchUsers.bind(userProfileService),
    getUserRentalHistory: userProfileService.getUserRentalHistory.bind(userProfileService),
    getTrustScoreDetails: userProfileService.getTrustScoreDetails.bind(userProfileService),
    // Favorites
    addToFavorites: userProfileService.addToFavorites.bind(userProfileService),
    removeFromFavorites: userProfileService.removeFromFavorites.bind(userProfileService),
    getUserFavorites: userProfileService.getUserFavorites.bind(userProfileService),
    isItemFavorited: userProfileService.isItemFavorited.bind(userProfileService),
  };
};

export default userProfileService;
