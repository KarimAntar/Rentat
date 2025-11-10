import { 
  doc, 
  getDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  GeoPoint,
  Timestamp
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { Item } from '../types';

export interface SearchFilters {
  // Basic filters
  query?: string;
  category?: string;
  subcategory?: string;
  
  // Location filters
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in kilometers
    city?: string;
    state?: string;
    country?: string;
  };
  
  // Date filters
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  
  // Price filters
  priceRange?: {
    min: number;
    max: number;
    currency?: string;
  };
  
  // Advanced filters
  features?: string[];
  condition?: ('new' | 'excellent' | 'good' | 'fair')[];
  availability?: 'available' | 'busy' | 'unavailable';
  deliveryOptions?: ('pickup' | 'delivery' | 'meetup')[];
  
  // Rating & verification
  minRating?: number;
  verifiedOwners?: boolean;
  instantBooking?: boolean;
  
  // Sorting & pagination
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'distance' | 'newest' | 'popular';
  limit?: number;
  offset?: number;
  lastDocumentId?: string;
}

export interface SearchResult {
  items: Item[];
  totalCount: number;
  hasMore: boolean;
  nextPageToken?: string;
  filters: {
    appliedFilters: SearchFilters;
    availableFilters: {
      categories: Array<{ id: string; name: string; count: number }>;
      priceRanges: Array<{ label: string; min: number; max: number; count: number }>;
      locations: Array<{ city: string; state: string; count: number }>;
      features: Array<{ feature: string; count: number }>;
    };
  };
  suggestions?: {
    didYouMean?: string;
    relatedSearches: string[];
    popularSearches: string[];
  };
  facets: {
    categoryFacets: Array<{ category: string; count: number }>;
    priceFacets: Array<{ range: string; count: number }>;
    locationFacets: Array<{ location: string; count: number }>;
  };
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueSearchers: number;
  averageResultsClicked: number;
  topSearchTerms: Array<{
    term: string;
    count: number;
    resultCount: number;
    clickRate: number;
  }>;
  popularFilters: Array<{
    filterType: string;
    filterValue: string;
    usageCount: number;
  }>;
  searchTrends: Array<{
    date: string;
    searches: number;
    uniqueUsers: number;
  }>;
  conversionMetrics: {
    searchToView: number;
    searchToContact: number;
    searchToBook: number;
  };
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: SearchFilters;
  alertsEnabled: boolean;
  frequency: 'instant' | 'daily' | 'weekly';
  lastMatchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchSuggestion {
  type: 'item' | 'category' | 'location' | 'feature';
  value: string;
  metadata?: {
    itemCount?: number;
    category?: string;
    location?: string;
  };
}

export class SearchService {
  private static instance: SearchService;

  private constructor() {}

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  // Main search function
  public async search(filters: SearchFilters): Promise<SearchResult> {
    try {
      // Start with a simple query to get items, then filter client-side
      // This avoids complex composite indexes for MVP
      let baseQuery = collection(db, collections.items);
      let constraints: any[] = [];

      // Basic availability filter - check status is active
      constraints.push(where('status', '==', 'active'));

      // For MVP, we'll use a simple query and do most filtering client-side
      // to avoid needing complex composite indexes
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(100)); // Get more items and filter client-side

      // Build the query
      const searchQuery = query(baseQuery, ...constraints);
      const snapshot = await getDocs(searchQuery);

      let items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Item[];

      // Apply client-side filters

      // Category filter
      if (filters.category && filters.category !== 'all') {
        items = items.filter(item => item.category === filters.category);
      }

      if (filters.subcategory) {
        items = items.filter(item => item.subcategory === filters.subcategory);
      }

      // Price range filter
      if (filters.priceRange) {
        if (filters.priceRange.min > 0) {
          items = items.filter(item => (item.pricing?.dailyRate || 0) >= filters.priceRange!.min);
        }
        if (filters.priceRange.max > 0 && filters.priceRange.max < 10000) {
          items = items.filter(item => (item.pricing?.dailyRate || 0) <= filters.priceRange!.max);
        }
      }

      // Condition filter
      if (filters.condition && filters.condition.length > 0) {
        items = items.filter(item =>
          filters.condition!.includes(item.condition as any)
        );
      }

      // Apply additional client-side filters that can't be done in Firestore

      // Text search filter (simple keyword matching)
      if (filters.query) {
        const queryLower = filters.query.toLowerCase();
        items = items.filter(item =>
          item.title.toLowerCase().includes(queryLower) ||
          item.description.toLowerCase().includes(queryLower) ||
          item.tags?.some(tag => tag.toLowerCase().includes(queryLower))
        );
      }

      // Verified owners filter - requires joining with users collection
      if (filters.verifiedOwners) {
        // For now, we'll skip this filter since it requires a join
        // In production, you'd want to denormalize this data or use a different approach
        console.log('Verified owners filter applied (simplified)');
      }

      // Min rating filter
      if (filters.minRating) {
        items = items.filter(item =>
          (item.ratings?.average || 0) >= filters.minRating!
        );
      }

      // Instant booking filter - requires checking owner preferences
      if (filters.instantBooking) {
        // For now, we'll skip this filter since it requires a join
        // In production, you'd want to denormalize this data
        console.log('Instant booking filter applied (simplified)');
      }

      // Location filter (distance calculation)
      if (filters.location) {
        items = items.filter(item => {
          if (!item.location?.latitude || !item.location?.longitude) return false;
          
          const distance = this.calculateDistance(
            filters.location!.latitude,
            filters.location!.longitude,
            item.location.latitude,
            item.location.longitude
          );
          
          return distance <= filters.location!.radius;
        });

        // Sort by distance if location filter is applied
        if (filters.sortBy === 'distance') {
          items = items.sort((a, b) => {
            const distanceA = this.calculateDistance(
              filters.location!.latitude,
              filters.location!.longitude,
              a.location?.latitude || 0,
              a.location?.longitude || 0
            );
            const distanceB = this.calculateDistance(
              filters.location!.latitude,
              filters.location!.longitude,
              b.location?.latitude || 0,
              b.location?.longitude || 0
            );
            return distanceA - distanceB;
          });
        }
      }

      // Date availability filter
      if (filters.dateRange) {
        items = await this.filterByAvailability(items, filters.dateRange);
      }

      // Delivery options filter
      if (filters.deliveryOptions && filters.deliveryOptions.length > 0) {
        items = items.filter(item => {
          if (!item.location?.deliveryOptions) return false;

          return filters.deliveryOptions!.some(option => {
            switch (option) {
              case 'pickup':
                return item.location?.deliveryOptions?.pickup;
              case 'delivery':
                return item.location?.deliveryOptions?.delivery;
              case 'meetup':
                return item.location?.deliveryOptions?.meetInMiddle;
              default:
                return false;
            }
          });
        });
      }

      // Apply boost prioritization (unless sorting by specific criteria)
      if (!filters.sortBy || filters.sortBy === 'relevance') {
        items = await this.applyBoostPrioritization(items);
      }

      // Calculate facets and suggestions
      const facets = await this.calculateFacets(items);
      const availableFilters = await this.getAvailableFilters(items);
      const suggestions = await this.generateSuggestions(filters.query || '');

      const totalCount = items.length;
      const hasMore = false; // Simplified for MVP - no pagination

      return {
        items,
        totalCount,
        hasMore,
        nextPageToken: hasMore ? snapshot.docs[snapshot.docs.length - 1].id : undefined,
        filters: {
          appliedFilters: filters,
          availableFilters,
        },
        suggestions,
        facets,
      };
    } catch (error) {
      console.error('Error performing search:', error);
      throw new Error('Search failed');
    }
  }

  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Filter items by date availability
  private async filterByAvailability(items: Item[], dateRange: { startDate: Date; endDate: Date }): Promise<Item[]> {
    // In a real implementation, this would check against booking calendar
    // For now, we'll return all items that are marked as available (simplified)
    return items.filter(item => {
      // Check if item has availability settings
      if (!item.availability) return true;

      // Simple check based on availability status
      return item.availability.isAvailable;
    });
  }

  // Apply boost prioritization to search results
  private async applyBoostPrioritization(items: Item[]): Promise<Item[]> {
    try {
      // Separate boosted and non-boosted items
      const boostedItems: Item[] = [];
      const nonBoostedItems: Item[] = [];

      items.forEach(item => {
        if (item.boost?.isActive && item.boost.endDate && item.boost.endDate > new Date()) {
          boostedItems.push(item);
        } else {
          nonBoostedItems.push(item);
        }
      });

      // Sort boosted items by boost level (higher searchBoost first)
      boostedItems.sort((a, b) => {
        const aBoost = a.boost?.searchBoost || 0;
        const bBoost = b.boost?.searchBoost || 0;
        return bBoost - aBoost;
      });

      // Sort non-boosted items by creation date (newest first)
      nonBoostedItems.sort((a, b) => {
        const aDate = a.createdAt?.getTime() || 0;
        const bDate = b.createdAt?.getTime() || 0;
        return bDate - aDate;
      });

      // Combine results: boosted items first, then non-boosted
      return [...boostedItems, ...nonBoostedItems];
    } catch (error) {
      console.error('Error applying boost prioritization:', error);
      // Return original items if boost prioritization fails
      return items;
    }
  }

  // Calculate search result facets
  private async calculateFacets(items: Item[]): Promise<{
    categoryFacets: Array<{ category: string; count: number }>;
    priceFacets: Array<{ range: string; count: number }>;
    locationFacets: Array<{ location: string; count: number }>;
  }> {
    const categoryMap = new Map<string, number>();
    const locationMap = new Map<string, number>();
    const priceRanges = [
      { range: '$0 - $25', min: 0, max: 2500 },
      { range: '$25 - $50', min: 2500, max: 5000 },
      { range: '$50 - $100', min: 5000, max: 10000 },
      { range: '$100 - $200', min: 10000, max: 20000 },
      { range: '$200+', min: 20000, max: Infinity },
    ];
    const priceMap = new Map<string, number>();

    items.forEach(item => {
      // Category facets
      if (item.category) {
        categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
      }

      // Location facets (simplified to just city since state doesn't exist in ItemLocation)
      if (item.location?.city) {
        const location = `${item.location.city}, ${item.location.country || ''}`;
        locationMap.set(location, (locationMap.get(location) || 0) + 1);
      }

      // Price facets
      const price = item.pricing?.dailyRate || 0;
      priceRanges.forEach(range => {
        if (price >= range.min && price < range.max) {
          priceMap.set(range.range, (priceMap.get(range.range) || 0) + 1);
        }
      });
    });

    return {
      categoryFacets: Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count,
      })),
      priceFacets: Array.from(priceMap.entries()).map(([range, count]) => ({
        range,
        count,
      })),
      locationFacets: Array.from(locationMap.entries()).map(([location, count]) => ({
        location,
        count,
      })),
    };
  }

  // Get available filters based on current results
  private async getAvailableFilters(items: Item[]): Promise<{
    categories: Array<{ id: string; name: string; count: number }>;
    priceRanges: Array<{ label: string; min: number; max: number; count: number }>;
    locations: Array<{ city: string; state: string; count: number }>;
    features: Array<{ feature: string; count: number }>;
  }> {
    const categoryMap = new Map<string, number>();
    const locationMap = new Map<string, { city: string; state: string; count: number }>();
    const featureMap = new Map<string, number>();

    items.forEach(item => {
      // Categories
      if (item.category) {
        categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
      }

      // Locations (using city and country since state doesn't exist)
      if (item.location?.city) {
        const key = `${item.location.city},${item.location.country || ''}`;
        const current = locationMap.get(key);
        if (current) {
          current.count++;
        } else {
          locationMap.set(key, {
            city: item.location.city,
            state: item.location.country || '',
            count: 1,
          });
        }
      }

      // Features (simplified since features doesn't exist on Item)
      // Skip features filtering for now
    });

    return {
      categories: Array.from(categoryMap.entries()).map(([id, count]) => ({
        id,
        name: this.getCategoryDisplayName(id),
        count,
      })),
      priceRanges: [
        { label: '$0 - $25', min: 0, max: 2500, count: items.filter(i => (i.pricing?.dailyRate || 0) < 2500).length },
        { label: '$25 - $50', min: 2500, max: 5000, count: items.filter(i => {
          const price = i.pricing?.dailyRate || 0;
          return price >= 2500 && price < 5000;
        }).length },
        { label: '$50 - $100', min: 5000, max: 10000, count: items.filter(i => {
          const price = i.pricing?.dailyRate || 0;
          return price >= 5000 && price < 10000;
        }).length },
        { label: '$100+', min: 10000, max: Infinity, count: items.filter(i => (i.pricing?.dailyRate || 0) >= 10000).length },
      ],
      locations: Array.from(locationMap.values()),
      features: Array.from(featureMap.entries()).map(([feature, count]) => ({
        feature,
        count,
      })),
    };
  }

  // Generate search suggestions
  private async generateSuggestions(query: string): Promise<{
    didYouMean?: string;
    relatedSearches: string[];
    popularSearches: string[];
  }> {
    // Simplified suggestion logic
    const popularSearches = [
      'camera equipment',
      'party supplies',
      'outdoor gear',
      'musical instruments',
      'sports equipment',
      'tools',
      'electronics',
      'furniture',
    ];

    const relatedSearches = [];
    
    if (query.toLowerCase().includes('camera')) {
      relatedSearches.push('photography equipment', 'lens rental', 'tripod rental');
    } else if (query.toLowerCase().includes('party')) {
      relatedSearches.push('decorations', 'sound system', 'tables and chairs');
    } else if (query.toLowerCase().includes('outdoor')) {
      relatedSearches.push('camping gear', 'hiking equipment', 'bike rental');
    } else {
      // Default related searches
      relatedSearches.push(...popularSearches.slice(0, 3));
    }

    return {
      relatedSearches,
      popularSearches,
    };
  }

  // Get category display name
  private getCategoryDisplayName(categoryId: string): string {
    const categoryMap: { [key: string]: string } = {
      electronics: 'Electronics',
      tools: 'Tools & Hardware',
      party: 'Party & Events',
      sports: 'Sports & Recreation',
      outdoor: 'Outdoor & Camping',
      music: 'Musical Instruments',
      photography: 'Photography',
      furniture: 'Furniture',
      automotive: 'Automotive',
      home: 'Home & Garden',
    };
    
    return categoryMap[categoryId] || categoryId;
  }

  // Save search for alerts
  public async saveSearch(
    userId: string,
    name: string,
    filters: SearchFilters,
    alertsEnabled: boolean = true,
    frequency: 'instant' | 'daily' | 'weekly' = 'daily'
  ): Promise<SavedSearch> {
    try {
      // Get current results count
      const searchResult = await this.search(filters);
      
      const savedSearchData: Omit<SavedSearch, 'id'> = {
        userId,
        name,
        filters,
        alertsEnabled,
        frequency,
        lastMatchCount: searchResult.totalCount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await getDocs(query(
        collection(db, 'saved_searches'),
        where('userId', '==', userId),
        where('name', '==', name)
      ));

      if (!docRef.empty) {
        throw new Error('Search with this name already exists');
      }

      const savedSearchRef = await addDoc(collection(db, 'saved_searches'), {
        ...savedSearchData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return {
        id: savedSearchRef.id,
        ...savedSearchData,
      };
    } catch (error) {
      console.error('Error saving search:', error);
      throw new Error('Failed to save search');
    }
  }

  // Get user's saved searches
  public async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    try {
      const savedSearchQuery = query(
        collection(db, 'saved_searches'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(savedSearchQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as SavedSearch[];
    } catch (error) {
      console.error('Error getting saved searches:', error);
      return [];
    }
  }

  // Get search suggestions for autocomplete
  public async getSearchSuggestions(partialQuery: string, limit: number = 10): Promise<SearchSuggestion[]> {
    try {
      const suggestions: SearchSuggestion[] = [];
      
      if (partialQuery.length < 2) {
        return suggestions;
      }

      const queryLower = partialQuery.toLowerCase();

      // Add category suggestions
      const categories = [
        'Electronics', 'Tools & Hardware', 'Party & Events', 'Sports & Recreation',
        'Outdoor & Camping', 'Musical Instruments', 'Photography', 'Furniture'
      ];
      
      categories.forEach(category => {
        if (category.toLowerCase().includes(queryLower)) {
          suggestions.push({
            type: 'category',
            value: category,
            metadata: { category: category.toLowerCase().replace(/\s+/g, '_') }
          });
        }
      });

      // Add popular item suggestions
      const popularItems = [
        'DSLR Camera', 'Power Drill', 'Tent', 'Guitar', 'Projector',
        'Sound System', 'Bicycle', 'Ladder', 'Generator'
      ];

      popularItems.forEach(item => {
        if (item.toLowerCase().includes(queryLower) && suggestions.length < limit) {
          suggestions.push({
            type: 'item',
            value: item,
          });
        }
      });

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }

  // Get trending searches
  public async getTrendingSearches(limit: number = 10): Promise<string[]> {
    try {
      // In a real implementation, this would analyze search analytics
      // For now, return static trending searches
      return [
        'camera rental',
        'party decorations',
        'camping gear',
        'power tools',
        'sound equipment',
        'outdoor furniture',
        'photography lighting',
        'musical instruments',
        'sports equipment',
        'gaming setup',
      ].slice(0, limit);
    } catch (error) {
      console.error('Error getting trending searches:', error);
      return [];
    }
  }

  // Get search analytics (admin only)
  public async getSearchAnalytics(dateRange?: { startDate: Date; endDate: Date }): Promise<SearchAnalytics> {
    try {
      // In a real implementation, this would query search logs
      // For now, return mock analytics data
      
      return {
        totalSearches: Math.floor(Math.random() * 10000) + 5000,
        uniqueSearchers: Math.floor(Math.random() * 2000) + 1000,
        averageResultsClicked: 2.3,
        topSearchTerms: [
          { term: 'camera', count: 1250, resultCount: 45, clickRate: 0.75 },
          { term: 'party', count: 980, resultCount: 32, clickRate: 0.68 },
          { term: 'tools', count: 875, resultCount: 67, clickRate: 0.71 },
          { term: 'outdoor', count: 760, resultCount: 28, clickRate: 0.65 },
          { term: 'music', count: 650, resultCount: 19, clickRate: 0.78 },
        ],
        popularFilters: [
          { filterType: 'category', filterValue: 'electronics', usageCount: 2500 },
          { filterType: 'price_range', filterValue: '$25-$50', usageCount: 1800 },
          { filterType: 'location', filterValue: 'within_10km', usageCount: 3200 },
          { filterType: 'rating', filterValue: '4_stars_plus', usageCount: 1200 },
        ],
        searchTrends: Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return {
            date: date.toISOString().split('T')[0],
            searches: Math.floor(Math.random() * 200) + 100,
            uniqueUsers: Math.floor(Math.random() * 100) + 50,
          };
        }).reverse(),
        conversionMetrics: {
          searchToView: 0.45,
          searchToContact: 0.12,
          searchToBook: 0.08,
        },
      };
    } catch (error) {
      console.error('Error getting search analytics:', error);
      throw new Error('Failed to get search analytics');
    }
  }

  // Advanced search with complex filters
  public async advancedSearch(filters: SearchFilters & {
    // Additional advanced filters
    tags?: string[];
    ownerId?: string;
    excludeOwners?: string[];
    minViews?: number;
    hasImages?: boolean;
    hasVideos?: boolean;
    responseTime?: 'within_hour' | 'within_day' | 'within_week';
    cancellationPolicy?: 'flexible' | 'moderate' | 'strict';
  }): Promise<SearchResult> {
    try {
      // Start with basic search
      const basicResult = await this.search(filters);
      let { items } = basicResult;

      // Apply additional filters
      if (filters.tags && filters.tags.length > 0) {
        items = items.filter(item =>
          filters.tags!.some(tag =>
            item.tags?.includes(tag)
          )
        );
      }

      if (filters.ownerId) {
        items = items.filter(item => item.ownerId === filters.ownerId);
      }

      if (filters.excludeOwners && filters.excludeOwners.length > 0) {
        items = items.filter(item =>
          !filters.excludeOwners!.includes(item.ownerId)
        );
      }

      if (filters.minViews) {
        items = items.filter(item =>
          (item.stats?.views || 0) >= filters.minViews!
        );
      }

      if (filters.hasImages !== undefined) {
        items = items.filter(item => {
          const hasImages = (item.images?.length || 0) > 0;
          return filters.hasImages ? hasImages : !hasImages;
        });
      }

      if (filters.hasVideos !== undefined) {
        items = items.filter(item => {
          // Videos property doesn't exist on Item, so simplified check
          return !filters.hasVideos; // For now, assume no items have videos
        });
      }

      if (filters.responseTime) {
        // Mock response time filter
        items = items.filter(item => {
          // In real implementation, would check owner's avg response time
          return true; // Simplified for demo
        });
      }

      if (filters.cancellationPolicy) {
        items = items.filter(item => {
          // cancellationPolicy doesn't exist on Item, so simplified check
          return true; // For now, include all items
        });
      }

      return {
        ...basicResult,
        items,
        totalCount: items.length,
      };
    } catch (error) {
      console.error('Error performing advanced search:', error);
      throw new Error('Advanced search failed');
    }
  }

  // Search nearby items using geolocation
  public async searchNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    additionalFilters?: Partial<SearchFilters>
  ): Promise<SearchResult> {
    try {
      const filters: SearchFilters = {
        location: {
          latitude,
          longitude,
          radius: radiusKm,
        },
        sortBy: 'distance',
        ...additionalFilters,
      };

      return await this.search(filters);
    } catch (error) {
      console.error('Error searching nearby items:', error);
      throw new Error('Nearby search failed');
    }
  }
}

// Export singleton instance
export const searchService = SearchService.getInstance();

// Convenience hook
export const useSearch = () => {
  return {
    search: searchService.search.bind(searchService),
    saveSearch: searchService.saveSearch.bind(searchService),
    getSavedSearches: searchService.getSavedSearches.bind(searchService),
    getSearchSuggestions: searchService.getSearchSuggestions.bind(searchService),
    getTrendingSearches: searchService.getTrendingSearches.bind(searchService),
    getSearchAnalytics: searchService.getSearchAnalytics.bind(searchService),
    advancedSearch: searchService.advancedSearch.bind(searchService),
    searchNearby: searchService.searchNearby.bind(searchService),
  };
};

export default searchService;
