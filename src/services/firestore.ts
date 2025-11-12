import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { User, Item, Rental, Review, WalletTransaction, Notification } from '../types';
import { commissionService } from './commission';

// Generic Firestore service class
export class FirestoreService {
  // Create document
  static async create<T>(collectionName: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  // Get document by ID
  static async getById<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  }

  // Update document
  static async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  }

  // Delete document
  static async delete(collectionName: string, id: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  }

  // Get documents with query
  static async getMany<T>(
    collectionName: string,
    constraints: any[] = [],
    limitCount?: number
  ): Promise<T[]> {
    try {
      let q = query(collection(db, collectionName), ...constraints);
      if (limitCount) {
        q = query(q, limit(limitCount));
      }
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }

  // Real-time listener
  static subscribe<T>(
    collectionName: string,
    callback: (data: T[]) => void,
    constraints: any[] = []
  ): Unsubscribe {
    const q = query(collection(db, collectionName), ...constraints);
    
    return onSnapshot(q, (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      callback(data);
    }, (error) => {
      console.error(`Error in subscription to ${collectionName}:`, error);
    });
  }

  // Subscribe to single document
  static subscribeToDoc<T>(
    collectionName: string,
    id: string,
    callback: (data: T | null) => void
  ): Unsubscribe {
    const docRef = doc(db, collectionName, id);
    
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as T);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error(`Error in document subscription:`, error);
    });
  }
}

// User-specific service
export class UserService extends FirestoreService {
  static async createUser(userId: string, userData: Omit<User, 'uid' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const docRef = doc(db, collections.users, userId);
      await updateDoc(docRef, {
        ...userData,
        uid: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async getUser(userId: string): Promise<User | null> {
    return this.getById<User>(collections.users, userId);
  }

  static async updateUser(userId: string, data: Partial<User>): Promise<void> {
    return this.update<User>(collections.users, userId, data);
  }

  static async getUsersByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<User[]> {
    // Note: This is a simplified location query. 
    // For production, consider using geohash or specialized geo libraries
    return this.getMany<User>(collections.users, [
      where('isActive', '==', true),
    ]);
  }

  static subscribeToUser(userId: string, callback: (user: User | null) => void): Unsubscribe {
    return this.subscribeToDoc<User>(collections.users, userId, callback);
  }
}

// Item-specific service
export class ItemService extends FirestoreService {
  static async createItem(itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<Item>(collections.items, itemData);
  }

  static async getItem(itemId: string): Promise<Item | null> {
    return this.getById<Item>(collections.items, itemId);
  }

  static async updateItem(itemId: string, data: Partial<Item>): Promise<void> {
    return this.update<Item>(collections.items, itemId, data);
  }

  static async deleteItem(itemId: string): Promise<void> {
    return this.delete(collections.items, itemId);
  }

  static async getItemsByOwner(ownerId: string): Promise<Item[]> {
    return this.getMany<Item>(collections.items, [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async getItemsByCategory(category: string, limitCount: number = 20): Promise<Item[]> {
    return this.getMany<Item>(collections.items, [
      where('category', '==', category),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    ], limitCount);
  }

  static async getActiveItems(limitCount: number = 20): Promise<Item[]> {
    return this.getMany<Item>(collections.items, [
      where('status', '==', 'active'),
      where('availability.isAvailable', '==', true),
      orderBy('createdAt', 'desc')
    ], limitCount);
  }

  static async getFeaturedItems(limitCount: number = 10): Promise<Item[]> {
    return this.getMany<Item>(collections.items, [
      where('featured.isFeatured', '==', true),
      where('status', '==', 'active'),
      orderBy('featured.featuredUntil', 'desc')
    ], limitCount);
  }

  static async searchItems(
    searchQuery: string,
    category?: string,
    limitCount: number = 20
  ): Promise<Item[]> {
    const constraints = [
      where('status', '==', 'active'),
    ];

    if (category) {
      constraints.push(where('category', '==', category));
    }

    // Note: Firestore doesn't support full-text search natively
    // For production, consider using Algolia or similar service
    return this.getMany<Item>(collections.items, constraints, limitCount);
  }

  static subscribeToItems(callback: (items: Item[]) => void, ownerId?: string): Unsubscribe {
    const constraints = ownerId 
      ? [where('ownerId', '==', ownerId), orderBy('createdAt', 'desc')]
      : [where('status', '==', 'active'), orderBy('createdAt', 'desc')];
    
    return this.subscribe<Item>(collections.items, callback, constraints);
  }
}

// Rental-specific service
export class RentalService extends FirestoreService {
  static async createRental(rentalData: Omit<Rental, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<Rental>(collections.rentals, rentalData);
  }

  static async getRental(rentalId: string): Promise<Rental | null> {
    return this.getById<Rental>(collections.rentals, rentalId);
  }

  static async updateRental(rentalId: string, data: Partial<Rental>): Promise<void> {
    return this.update<Rental>(collections.rentals, rentalId, data);
  }

  static async completeRental(rentalId: string): Promise<void> {
    try {
      // Get rental details
      const rental = await this.getRental(rentalId);
      if (!rental) {
        throw new Error('Rental not found');
      }

      // Update rental status to completed
      await this.update<Rental>(collections.rentals, rentalId, {
        status: 'completed',
        dates: {
          ...rental.dates,
          actualEnd: new Date(),
        },
      });

      // Process commission automatically
      try {
        await commissionService.processCommission(rentalId);
      } catch (commissionError) {
        console.error('Error processing commission:', commissionError);
        // Don't throw - rental completion should succeed even if commission fails
        // Commission can be processed later via admin tools
      }
    } catch (error) {
      console.error('Error completing rental:', error);
      throw error;
    }
  }

  static async getRentalsByUser(userId: string, asOwner: boolean = false): Promise<Rental[]> {
    const field = asOwner ? 'ownerId' : 'renterId';
    return this.getMany<Rental>(collections.rentals, [
      where(field, '==', userId),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async getRentalsByItem(itemId: string): Promise<Rental[]> {
    return this.getMany<Rental>(collections.rentals, [
      where('itemId', '==', itemId),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async getPendingRentals(ownerId: string): Promise<Rental[]> {
    return this.getMany<Rental>(collections.rentals, [
      where('ownerId', '==', ownerId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async getOwnerRentalRequests(ownerId: string): Promise<Rental[]> {
    return this.getMany<Rental>(collections.rentals, [
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async approveRental(rentalId: string): Promise<void> {
    try {
      const rental = await this.getRental(rentalId);
      if (!rental) {
        throw new Error('Rental not found');
      }

      // Update status and confirmed dates separately to comply with Firestore rules
      await this.update<Rental>(collections.rentals, rentalId, {
        status: 'approved',
      });

      // Update confirmed dates using Firestore field paths
      const docRef = doc(db, collections.rentals, rentalId);
      await updateDoc(docRef, {
        'dates.confirmedStart': rental.dates.requestedStart,
        'dates.confirmedEnd': rental.dates.requestedEnd,
        updatedAt: serverTimestamp(),
      });

    } catch (error) {
      console.error('Error approving rental:', error);
      throw error;
    }
  }

  static async rejectRental(rentalId: string): Promise<void> {
    return this.update<Rental>(collections.rentals, rentalId, {
      status: 'rejected',
    });
  }

  static subscribeToUserRentals(
    userId: string,
    callback: (rentals: Rental[]) => void,
    asOwner: boolean = false
  ): Unsubscribe {
    const field = asOwner ? 'ownerId' : 'renterId';
    return this.subscribe<Rental>(collections.rentals, callback, [
      where(field, '==', userId),
      orderBy('createdAt', 'desc')
    ]);
  }
}

// Review-specific service
export class ReviewService extends FirestoreService {
  static async createReview(reviewData: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<Review>(collections.reviews, reviewData);
  }

  static async getReview(reviewId: string): Promise<Review | null> {
    return this.getById<Review>(collections.reviews, reviewId);
  }

  static async updateReview(reviewId: string, data: Partial<Review>): Promise<void> {
    return this.update<Review>(collections.reviews, reviewId, data);
  }

  static async getReviewsForUser(userId: string): Promise<Review[]> {
    return this.getMany<Review>(collections.reviews, [
      where('revieweeId', '==', userId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async getReviewsForItem(itemId: string): Promise<Review[]> {
    return this.getMany<Review>(collections.reviews, [
      where('itemId', '==', itemId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async getReviewsByRental(rentalId: string): Promise<Review[]> {
    return this.getMany<Review>(collections.reviews, [
      where('rentalId', '==', rentalId),
      orderBy('createdAt', 'desc')
    ]);
  }
}

// Wallet transaction service
export class WalletService extends FirestoreService {
  static async createTransaction(transactionData: Omit<WalletTransaction, 'id' | 'createdAt' | 'processedAt'>): Promise<string> {
    return this.create<WalletTransaction>(collections.walletTransactions, transactionData);
  }

  static async getTransaction(transactionId: string): Promise<WalletTransaction | null> {
    return this.getById<WalletTransaction>(collections.walletTransactions, transactionId);
  }

  static async updateTransaction(transactionId: string, data: Partial<WalletTransaction>): Promise<void> {
    return this.update<WalletTransaction>(collections.walletTransactions, transactionId, data);
  }

  static async getUserTransactions(userId: string): Promise<WalletTransaction[]> {
    return this.getMany<WalletTransaction>(collections.walletTransactions, [
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    ]);
  }

  static async getUserBalance(userId: string): Promise<number> {
    const transactions = await this.getUserTransactions(userId);
    return transactions
      .filter(t => t.status === 'completed')
      .reduce((balance, transaction) => {
        switch (transaction.type) {
          case 'rental_payout':
          case 'deposit_release':
            return balance + transaction.amount;
          case 'rental_payment':
          case 'deposit_hold':
          case 'fee':
          case 'withdrawal':
            return balance - transaction.amount;
          case 'refund':
            return balance + transaction.amount;
          default:
            return balance;
        }
      }, 0);
  }

  static subscribeToUserTransactions(
    userId: string,
    callback: (transactions: WalletTransaction[]) => void
  ): Unsubscribe {
    return this.subscribe<WalletTransaction>(collections.walletTransactions, callback, [
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    ]);
  }
}

// Notification service
export class NotificationService extends FirestoreService {
  static async createNotification(notificationData: Omit<Notification, 'id' | 'createdAt' | 'readAt'>): Promise<string> {
    return this.create<Notification>(collections.notifications, notificationData);
  }

  static async getNotification(notificationId: string): Promise<Notification | null> {
    return this.getById<Notification>(collections.notifications, notificationId);
  }

  static async updateNotification(notificationId: string, data: Partial<Notification>): Promise<void> {
    return this.update<Notification>(collections.notifications, notificationId, data);
  }

  static async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    const constraints: any[] = [where('userId', '==', userId)];
    if (unreadOnly) {
      constraints.push(where('status', '==', 'unread'));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    return this.getMany<Notification>(collections.notifications, constraints);
  }

  static async markAsRead(notificationId: string): Promise<void> {
    return this.update<Notification>(collections.notifications, notificationId, {
      status: 'read',
      readAt: serverTimestamp() as any,
    });
  }

  static async markAllAsRead(userId: string): Promise<void> {
    const unreadNotifications = await this.getUserNotifications(userId, true);
    const promises = unreadNotifications.map(notification => 
      this.markAsRead(notification.id)
    );
    await Promise.all(promises);
  }

  static subscribeToUserNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    unreadOnly: boolean = false
  ): Unsubscribe {
    const constraints: any[] = [where('userId', '==', userId)];
    if (unreadOnly) {
      constraints.push(where('status', '==', 'unread'));
    }
    constraints.push(orderBy('createdAt', 'desc'));

    return this.subscribe<Notification>(collections.notifications, callback, constraints);
  }
}
