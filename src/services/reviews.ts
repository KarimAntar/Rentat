import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  getDocs,
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  DocumentSnapshot
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { Review, ReviewType, User } from '../types';

export interface CreateReviewData {
  rentalId: string;
  revieweeId: string;
  itemId: string;
  type: ReviewType;
  ratings: {
    overall: number;
    communication?: number;
    reliability?: number;
    condition?: number;
    accuracy?: number;
  };
  comment: string;
  title?: string;
  images?: string[];
  isAnonymous?: boolean;
}

export interface ReviewFilters {
  type?: ReviewType;
  rating?: number;
  limit?: number;
  lastDoc?: DocumentSnapshot;
}

export interface ReviewStats {
  average: number;
  count: number;
  distribution: Record<number, number>; // rating -> count
}

export class ReviewService {
  private static instance: ReviewService;

  private constructor() {}

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  // Create a new review
  public async createReview(reviewData: CreateReviewData, reviewerId: string): Promise<string> {
    try {
      const reviewDoc = {
        rentalId: reviewData.rentalId,
        reviewerId,
        revieweeId: reviewData.revieweeId,
        itemId: reviewData.itemId,
        type: reviewData.type,
        ratings: reviewData.ratings,
        review: {
          title: reviewData.title,
          comment: reviewData.comment,
          images: reviewData.images,
        },
        status: 'active' as const,
        helpfulVotes: {
          count: 0,
          voters: [],
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, collections.reviews), reviewDoc);
      
      // Update user ratings in a transaction
      const ratingType = this.mapReviewTypeToUserRating(reviewData.type);
      await this.updateUserRatings(reviewData.revieweeId, ratingType, reviewData.ratings.overall);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating review:', error);
      throw new Error('Failed to create review');
    }
  }

  // Map review type to user rating type
  private mapReviewTypeToUserRating(reviewType: ReviewType): 'asOwner' | 'asRenter' {
    switch (reviewType) {
      case 'owner-to-renter':
        return 'asRenter';
      case 'renter-to-owner':
        return 'asOwner';
      case 'item-review':
        return 'asOwner'; // Item reviews affect the owner
      default:
        return 'asOwner';
    }
  }

  // Update user ratings after a new review
  private async updateUserRatings(userId: string, type: 'asOwner' | 'asRenter', rating: number): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, collections.users, userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data() as User;
        const currentRating = (userData.ratings as any)?.[type] || { average: 0, count: 0 };
        
        // Calculate new average
        const totalRating = (currentRating.average * currentRating.count) + rating;
        const newCount = currentRating.count + 1;
        const newAverage = totalRating / newCount;

        transaction.update(userRef, {
          [`ratings.${type}`]: {
            average: Math.round(newAverage * 10) / 10, // Round to 1 decimal
            count: newCount,
          },
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('Error updating user ratings:', error);
      throw error;
    }
  }

  // Get reviews for a user
  public async getUserReviews(
    userId: string, 
    type: ReviewType,
    filters?: ReviewFilters
  ): Promise<{ reviews: Review[]; lastDoc?: DocumentSnapshot }> {
    try {
      let q = query(
        collection(db, collections.reviews),
        where('revieweeId', '==', userId),
        where('type', '==', type),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );

      // Apply filters
      if (filters?.rating) {
        q = query(q, where('rating', '==', filters.rating));
      }

      if (filters?.limit) {
        q = query(q, limit(filters.limit));
      }

      if (filters?.lastDoc) {
        q = query(q, startAfter(filters.lastDoc));
      }

      const snapshot = await getDocs(q);
      const reviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Review[];

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      return { reviews, lastDoc };
    } catch (error) {
      console.error('Error getting user reviews:', error);
      throw new Error('Failed to get reviews');
    }
  }

  // Get review by ID
  public async getReview(reviewId: string): Promise<Review | null> {
    try {
      const reviewDoc = await getDoc(doc(db, collections.reviews, reviewId));
      
      if (!reviewDoc.exists()) {
        return null;
      }

      return {
        id: reviewDoc.id,
        ...reviewDoc.data(),
        createdAt: reviewDoc.data().createdAt?.toDate(),
        updatedAt: reviewDoc.data().updatedAt?.toDate(),
      } as Review;
    } catch (error) {
      console.error('Error getting review:', error);
      throw new Error('Failed to get review');
    }
  }

  // Update review
  public async updateReview(
    reviewId: string, 
    updates: Partial<Pick<Review, 'ratings' | 'review'>>
  ): Promise<void> {
    try {
      const reviewRef = doc(db, collections.reviews, reviewId);
      await updateDoc(reviewRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating review:', error);
      throw new Error('Failed to update review');
    }
  }

  // Delete review
  public async deleteReview(reviewId: string): Promise<void> {
    try {
      const reviewRef = doc(db, collections.reviews, reviewId);
      const reviewDoc = await getDoc(reviewRef);
      
      if (!reviewDoc.exists()) {
        throw new Error('Review not found');
      }

      const reviewData = reviewDoc.data() as Review;
      
      // Remove the review's impact on user ratings
      await this.removeReviewFromRatings(
        reviewData.revieweeId, 
        reviewData.type, 
        reviewData.ratings.overall
      );
      
      // Delete the review
      await deleteDoc(reviewRef);
    } catch (error) {
      console.error('Error deleting review:', error);
      throw new Error('Failed to delete review');
    }
  }

  // Remove review impact from user ratings
  private async removeReviewFromRatings(
    userId: string, 
    type: ReviewType, 
    rating: number
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, collections.users, userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data() as User;
        const currentRating = (userData.ratings as any)?.[type] || { average: 0, count: 0 };
        
        if (currentRating.count <= 1) {
          // If this is the only review, reset to 0
          transaction.update(userRef, {
            [`ratings.${type}`]: { average: 0, count: 0 },
            updatedAt: serverTimestamp(),
          });
        } else {
          // Recalculate average without this rating
          const totalRating = (currentRating.average * currentRating.count) - rating;
          const newCount = currentRating.count - 1;
          const newAverage = totalRating / newCount;

          transaction.update(userRef, {
            [`ratings.${type}`]: {
              average: Math.round(newAverage * 10) / 10,
              count: newCount,
            },
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error('Error removing review from ratings:', error);
      throw error;
    }
  }

  // Add response to review (for reviewees)
  public async addReviewResponse(reviewId: string, response: string): Promise<void> {
    try {
      const reviewRef = doc(db, collections.reviews, reviewId);
      await updateDoc(reviewRef, {
        response,
        responseDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding review response:', error);
      throw new Error('Failed to add response');
    }
  }

  // Mark review as helpful
  public async markReviewHelpful(reviewId: string, userId: string): Promise<void> {
    try {
      // In a real implementation, you'd track which users marked reviews as helpful
      // to prevent duplicate votes
      const reviewRef = doc(db, collections.reviews, reviewId);
      const reviewDoc = await getDoc(reviewRef);
      
      if (!reviewDoc.exists()) {
        throw new Error('Review not found');
      }

      const currentCount = reviewDoc.data().helpfulCount || 0;
      await updateDoc(reviewRef, {
        helpfulCount: currentCount + 1,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking review as helpful:', error);
      throw new Error('Failed to mark review as helpful');
    }
  }

  // Report review
  public async reportReview(
    reviewId: string, 
    userId: string, 
    reason: string
  ): Promise<void> {
    try {
      const reviewRef = doc(db, collections.reviews, reviewId);
      const reviewDoc = await getDoc(reviewRef);
      
      if (!reviewDoc.exists()) {
        throw new Error('Review not found');
      }

      // Create a report document
      await addDoc(collection(db, 'review_reports'), {
        reviewId,
        reportedBy: userId,
        reason,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Increment report count
      const currentCount = reviewDoc.data().reportCount || 0;
      await updateDoc(reviewRef, {
        reportCount: currentCount + 1,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error reporting review:', error);
      throw new Error('Failed to report review');
    }
  }

  // Get review statistics for a user
  public async getReviewStats(userId: string, type: ReviewType): Promise<ReviewStats> {
    try {
      const q = query(
        collection(db, collections.reviews),
        where('revieweeId', '==', userId),
        where('type', '==', type),
        where('status', '==', 'published')
      );

      const snapshot = await getDocs(q);
      const reviews = snapshot.docs.map(doc => doc.data()) as Review[];

      if (reviews.length === 0) {
        return {
          average: 0,
          count: 0,
          distribution: {},
        };
      }

      // Calculate statistics
      const distribution: Record<number, number> = {};
      const tags: Record<string, number> = {};
      let totalRating = 0;

      reviews.forEach(review => {
        totalRating += review.ratings.overall;
        distribution[review.ratings.overall] = (distribution[review.ratings.overall] || 0) + 1;
      });

      return {
        average: Math.round((totalRating / reviews.length) * 10) / 10,
        count: reviews.length,
        distribution,
      };
    } catch (error) {
      console.error('Error getting review stats:', error);
      throw new Error('Failed to get review statistics');
    }
  }

  // Check if user can review (one review per rental)
  public async canUserReview(
    rentalId: string, 
    reviewerId: string, 
    type: ReviewType
  ): Promise<boolean> {
    try {
      const q = query(
        collection(db, collections.reviews),
        where('rentalId', '==', rentalId),
        where('reviewerId', '==', reviewerId),
        where('type', '==', type)
      );

      const snapshot = await getDocs(q);
      return snapshot.empty; // Can review if no existing review found
    } catch (error) {
      console.error('Error checking if user can review:', error);
      return false;
    }
  }

  // Get pending reviews for a user (reviews they need to write)
  public async getPendingReviews(userId: string): Promise<string[]> {
    try {
      // This would query completed rentals where the user hasn't written a review yet
      // Implementation depends on your rental service structure
      
      // For now, return empty array - this would be implemented based on
      // your rental completion logic
      return [];
    } catch (error) {
      console.error('Error getting pending reviews:', error);
      throw new Error('Failed to get pending reviews');
    }
  }

  // Get common review tags for a category
  public getCommonReviewTags(type: 'asOwner' | 'asRenter'): string[] {
    const ownerTags = [
      'Responsive',
      'Clear communication',
      'Flexible',
      'Trustworthy',
      'Professional',
      'Accommodating',
      'Quick response',
      'Easy to work with',
      'Fair pricing',
      'Reliable',
    ];

    const renterTags = [
      'Careful with item',
      'On time',
      'Respectful',
      'Clean return',
      'Good communication',
      'Followed instructions',
      'Reliable',
      'Trustworthy',
      'Polite',
      'Recommended',
    ];

    return type === 'asOwner' ? renterTags : ownerTags;
  }
}

// Export singleton instance
export const reviewService = ReviewService.getInstance();

// Convenience hook
export const useReviews = () => {
  return {
    createReview: reviewService.createReview.bind(reviewService),
    getUserReviews: reviewService.getUserReviews.bind(reviewService),
    getReview: reviewService.getReview.bind(reviewService),
    updateReview: reviewService.updateReview.bind(reviewService),
    deleteReview: reviewService.deleteReview.bind(reviewService),
    addReviewResponse: reviewService.addReviewResponse.bind(reviewService),
    markReviewHelpful: reviewService.markReviewHelpful.bind(reviewService),
    reportReview: reviewService.reportReview.bind(reviewService),
    getReviewStats: reviewService.getReviewStats.bind(reviewService),
    canUserReview: reviewService.canUserReview.bind(reviewService),
    getPendingReviews: reviewService.getPendingReviews.bind(reviewService),
    getCommonReviewTags: reviewService.getCommonReviewTags.bind(reviewService),
  };
};

export default reviewService;
