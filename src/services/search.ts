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
    start: Date;
    end: Date;
  };
  
  // Price filters
  priceRange?: {
    min: number;
    max: number;
    currency?: string;
  };
  
  // Advanced filters
  features?: string[];
  condition?: ('new' | 'like-new' | 'good' | 'fair' | 'poor')[];
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
      const baseRef = collection(db, collections.items);
      const constraints: any[] = [];

      // Always only return active/listable items unless requested otherwise
      if (!filters.availability || filters.availability === 'available') {
        constraints.push(where('status', '==', 'active'));
      } else if (filters.availability === 'busy') {
        constraints.push(where('status', '==', 'busy'));
      } else if (filters.availability === 'unavailable') {
        constraints.push(where('status', '==', 'unavailable'));
      }

      // Category/subcategory - server-side
      if (filters.category && filters.category !== 'all') {
        constraints.push(where('category', '==', filters.category));
      }
      if (filters.subcategory) {
        constraints.push(where('subcategory', '==', filters.subcategory));
      }

      // Price range - server-side partial (requires composite indexes for complex combinations)
      if (filters.priceRange) {
        const min = typeof filters.priceRange.min === 'number' ? filters.priceRange.min : 0;
        const max = typeof filters.priceRange.max === 'number' ? filters.priceRange.max : Number.POSITIVE_INFINITY;

        // Only add server-side bounds when they are finite numbers
        if (isFinite(min)) {
          constraints.push(where('pricing.dailyRate', '>=', min));
        }
        if (isFinite(max)) {
          constraints.push(where('pricing.dailyRate', '<=', max));
        }
      }

      // Condition filter - use 'in' query when possible
      if (filters.condition && filters.condition.length > 0) {
        // Firestore 'in' supports up to 10 values
        constraints.push(where('condition', 'in', filters.condition.slice(0, 10) as any));
      }

      // Minimum rating
      if (typeof filters.minRating === 'number') {
        constraints.push(where('ratings.average', '>=', filters.minRating));
      }

      // Basic sorting: construct orderBy clauses carefully to satisfy Firestore
      const limitCount = filters.limit || 30;

      // Build an ordered list of orderBy clauses. Firestore requires that range filters use the same field that is ordered first
      const orderClauses: Array<ReturnType<typeof orderBy>> = [];

      // Prefer explicit ordering requested by user
      if (filters.sortBy === 'price_low' || filters.sortBy === 'price_high') {
        // If ordering by price, ensure we order by pricing.dailyRate first (Firestone may require an index if combined with other where clauses)
        orderClauses.push(orderBy('pricing.dailyRate', filters.sortBy === 'price_low' ? 'asc' : 'desc') as any);
        // Fallback to createdAt for determinism
        orderClauses.push(orderBy('createdAt', 'desc') as any);
      } else if (filters.sortBy === 'rating') {
        orderClauses.push(orderBy('ratings.average', 'desc') as any);
        orderClauses.push(orderBy('createdAt', 'desc') as any);
      } else if (filters.sortBy === 'newest') {
        orderClauses.push(orderBy('createdAt', 'desc') as any);
      } else if (filters.sortBy === 'distance' && filters.location) {
        // Cannot order by distance server-side; use createdAt server-side and sort client-side by distance
        orderClauses.push(orderBy('createdAt', 'desc') as any);
      } else {
        // Default ordering
        orderClauses.push(orderBy('createdAt', 'desc') as any);
      }

      // Apply order clauses to constraints
      for (const oc of orderClauses) {
        constraints.push(oc as any);
      }

      constraints.push(limit(limitCount));

      // Pagination support (startAfter) - requires passing lastDocumentId which we try to resolve
      if (filters.lastDocumentId) {
        try {
          const lastDocRef = doc(db, collections.items, filters.lastDocumentId);
          const lastSnap = await getDoc(lastDocRef as any);
          if (lastSnap.exists()) {
            constraints.push(startAfter(lastSnap));
          }
        } catch (err) {
          // ignore pagination if last document not found
        }
      }

      // Location bounding box - reduce server-side result set when location filter exists
      if (filters.location) {
        const { latitude, longitude, radius } = filters.location;
        // Approximate bounding box (latitude +/-, longitude +/-)
        const latDelta = radius / 111.12; // ~km per degree latitude
        const lngDelta = Math.abs(radius / (111.12 * Math.cos((latitude * Math.PI) / 180)));

        const minLat = latitude - latDelta;
        const maxLat = latitude + latDelta;
        const minLng = longitude - lngDelta;
        const maxLng = longitude + lngDelta;

        // These range queries may require composite indexes to work together with other where clauses.
        constraints.push(where('location.latitude', '>=', minLat));
        constraints.push(where('location.latitude', '<=', maxLat));
        constraints.push(where('location.longitude', '>=', minLng));
        constraints.push(where('location.longitude', '<=', maxLng));
      }

      // Build the Firestore query
      const firestoreQuery = query(baseRef, ...constraints);

      // Execute server-side query
      const snapshot = await getDocs(firestoreQuery);

      // Map to items
      let items = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        } as Item;
      });

      // Client-side filters that are hard/expensive server-side
      // Text search
      if (filters.query) {
        const qLower = filters.query.toLowerCase();
        items = items.filter(item =>
          (item.title || '').toLowerCase().includes(qLower) ||
          (item.description || '').toLowerCase().includes(qLower) ||
          (item.tags || []).some((t: string) => t.toLowerCase().includes(qLower))
        );
      }

      // Delivery options - cannot OR across different fields reliably server-side without composite indexes, so apply client-side
      if (filters.deliveryOptions && filters.deliveryOptions.length > 0) {
        items = items.filter(item => {
          if (!item.location?.deliveryOptions) return false;
          return filters.deliveryOptions!.some(option => {
            switch (option) {
              case 'pickup': return !!item.location.deliveryOptions.pickup;
              case 'delivery': return !!item.location.deliveryOptions.delivery;
              case 'meetup': return !!item.location.deliveryOptions.meetInMiddle;
              default: return false;
            }
          });
        });
      }

      // Exact distance filtering and precise sorting when location is provided
      if (filters.location) {
        items = items
          .map(it => {
            if (!it.location?.latitude || !it.location?.longitude) return { item: it, distance: Number.POSITIVE_INFINITY };
            const dist = this.calculateDistance(filters.location!.latitude, filters.location!.longitude, it.location.latitude, it.location.longitude);
            return { item: it, distance: dist };
          })
          .filter(x => x.distance <= (filters.location!.radius || Number.POSITIVE_INFINITY))
          .sort((a, b) => a.distance - b.distance)
          .map(x => x.item);
      }

      // Date availability filter (still client-side)
      if (filters.dateRange) {
        items = await this.filterByAvailability(items, filters.dateRange);
      }

      // Verified owners - still a client-side join (fetch minimal owners)
      if (filters.verifiedOwners) {
        const ownerIds = Array.from(new Set(items.map(i => i.ownerId)));
        const verified = new Set<string>();
        for (const ownerId of ownerIds) {
          try {
            const u = await getDoc(doc(db, collections.users, ownerId));
            if (u.exists()) {
              const ud = u.data();
              if (ud.verification?.isVerified) verified.add(ownerId);
            }
          } catch (err) {
            // ignore
          }
        }
        items = items.filter(i => verified.has(i.ownerId));
      }

      // Min rating filter if not applied server-side
      if (typeof filters.minRating === 'number') {
        items = items.filter(i => (i.ratings?.average || 0) >= filters.minRating!);
      }

      // Apply remaining sorting client-side for fields Firestore couldn't sort by (price when not ordered, relevance, popularity)
      items = await this.applySorting(items, filters.sortBy || 'relevance', filters.location);

      // Facets and available filters (based on returned items)
      const facets = await this.calculateFacets(items);
      const availableFilters = await this.getAvailableFilters(items);
      const suggestions = await this.generateSuggestions(filters.query || '');

      const totalCount = items.length;
      const hasMore = snapshot.docs.length === limitCount; // heuristic

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
  private async filterByAvailability(items: Item[], dateRange: { start: Date; end: Date }): Promise<Item[]> {
    // In a real implementation, this would check against booking calendar
    // For now, we'll return all items that are marked as available (simplified)
    return items.filter(item => {
      // Check if item has availability settings
      if (!item.availability) return true;

      // Simple check based on availability status
      return item.availability.isAvailable;
    });
  }

  // Apply sorting to search results
  private async applySorting(items: Item[], sortBy: string, location?: { latitude: number; longitude: number; radius: number }): Promise<Item[]> {
    switch (sortBy) {
      case 'price_low':
        return items.sort((a, b) => (a.pricing?.dailyRate || 0) - (b.pricing?.dailyRate || 0));
      
      case 'price_high':
        return items.sort((a, b) => (b.pricing?.dailyRate || 0) - (a.pricing?.dailyRate || 0));
      
      case 'rating':
        return items.sort((a, b) => (b.ratings?.average || 0) - (a.ratings?.average || 0));
      
      case 'newest':
        return items.sort((a, b) => {
          const aDate = a.createdAt?.getTime() || 0;
          const bDate = b.createdAt?.getTime() || 0;
          return bDate - aDate;
        });
      
      case 'distance':
        if (location) {
          return items.sort((a, b) => {
            const distanceA = this.calculateDistance(
              location.latitude,
              location.longitude,
              a.location?.latitude || 0,
              a.location?.longitude || 0
            );
            const distanceB = this.calculateDistance(
              location.latitude,
              location.longitude,
              b.location?.latitude || 0,
              b.location?.longitude || 0
            );
            return distanceA - distanceB;
          });
        }
        return items;
      
      case 'relevance':
      default:
        return await this.applyBoostPrioritization(items);
    }
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
