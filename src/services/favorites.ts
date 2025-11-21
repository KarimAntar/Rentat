import { db, collections } from '../config/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { Item } from '../types';
import { ItemService } from './firestore';

export interface FavoriteItem {
  id: string;
  userId: string;
  itemId: string;
  addedAt: Date;
  item?: Item;
}

export class FavoritesService {
  private static instance: FavoritesService;

  private constructor() {}

  public static getInstance(): FavoritesService {
    if (!FavoritesService.instance) {
      FavoritesService.instance = new FavoritesService();
    }
    return FavoritesService.instance;
  }

  // Add item to favorites
  async addToFavorites(userId: string, itemId: string): Promise<void> {
    try {
      const favoriteId = `${userId}_${itemId}`;
      const favoriteRef = doc(db, collections.favorites, favoriteId);

      await setDoc(favoriteRef, {
        id: favoriteId,
        userId,
        itemId,
        addedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw error;
    }
  }

  // Remove item from favorites
  async removeFromFavorites(userId: string, itemId: string): Promise<void> {
    try {
      const favoriteId = `${userId}_${itemId}`;
      const favoriteRef = doc(db, collections.favorites, favoriteId);

      await deleteDoc(favoriteRef);
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw error;
    }
  }

  // Check if item is favorited
  async isItemFavorited(userId: string, itemId: string): Promise<boolean> {
    try {
      const favoriteId = `${userId}_${itemId}`;
      const favoriteRef = doc(db, collections.favorites, favoriteId);
      const favoriteDoc = await getDoc(favoriteRef);

      return favoriteDoc.exists();
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }
  }

  // Get user's favorite item IDs
  async getUserFavoriteIds(userId: string): Promise<string[]> {
    try {
      const favoritesQuery = query(
        collection(db, collections.favorites),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(favoritesQuery);
      return snapshot.docs.map(doc => doc.data().itemId);
    } catch (error) {
      console.error('Error getting favorite IDs:', error);
      return [];
    }
  }

  // Get user's favorite items with full item details
  async getUserFavorites(userId: string): Promise<FavoriteItem[]> {
    try {
      const favoritesQuery = query(
        collection(db, collections.favorites),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(favoritesQuery);
      const favorites: FavoriteItem[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const favorite: FavoriteItem = {
          id: data.id,
          userId: data.userId,
          itemId: data.itemId,
          addedAt: data.addedAt?.toDate() || new Date(),
        };

        // Fetch the item details
        try {
          const item = await ItemService.getItem(data.itemId);
          if (item && item.status === 'active') {
            favorite.item = item;
            favorites.push(favorite);
          }
        } catch (itemError) {
          console.error(`Error fetching item ${data.itemId}:`, itemError);
          // Still add the favorite even if item fetch fails
          favorites.push(favorite);
        }
      }

      // Sort by most recently added
      favorites.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());

      return favorites;
    } catch (error) {
      console.error('Error getting user favorites:', error);
      return [];
    }
  }

  // Toggle favorite status
  async toggleFavorite(userId: string, itemId: string): Promise<boolean> {
    try {
      const isFavorited = await this.isItemFavorited(userId, itemId);

      if (isFavorited) {
        await this.removeFromFavorites(userId, itemId);
        return false;
      } else {
        await this.addToFavorites(userId, itemId);
        return true;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  // Get favorite count for an item
  async getItemFavoriteCount(itemId: string): Promise<number> {
    try {
      const favoritesQuery = query(
        collection(db, collections.favorites),
        where('itemId', '==', itemId)
      );

      const snapshot = await getDocs(favoritesQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting favorite count:', error);
      return 0;
    }
  }

  // Clear all favorites for a user
  async clearUserFavorites(userId: string): Promise<void> {
    try {
      const favoritesQuery = query(
        collection(db, collections.favorites),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(favoritesQuery);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error clearing user favorites:', error);
      throw error;
    }
  }

  // Remove all favorites for an item (when item is deleted)
  async removeItemFromAllFavorites(itemId: string): Promise<void> {
    try {
      const favoritesQuery = query(
        collection(db, collections.favorites),
        where('itemId', '==', itemId)
      );

      const snapshot = await getDocs(favoritesQuery);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error removing item from favorites:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const favoritesService = FavoritesService.getInstance();

// Convenience hook
export const useFavorites = () => {
  return {
    addToFavorites: favoritesService.addToFavorites.bind(favoritesService),
    removeFromFavorites: favoritesService.removeFromFavorites.bind(favoritesService),
    isItemFavorited: favoritesService.isItemFavorited.bind(favoritesService),
    getUserFavoriteIds: favoritesService.getUserFavoriteIds.bind(favoritesService),
    getUserFavorites: favoritesService.getUserFavorites.bind(favoritesService),
    toggleFavorite: favoritesService.toggleFavorite.bind(favoritesService),
    getItemFavoriteCount: favoritesService.getItemFavoriteCount.bind(favoritesService),
    clearUserFavorites: favoritesService.clearUserFavorites.bind(favoritesService),
    removeItemFromAllFavorites: favoritesService.removeItemFromAllFavorites.bind(favoritesService),
  };
};

export default favoritesService;
