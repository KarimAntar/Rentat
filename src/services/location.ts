import * as Location from 'expo-location';
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
  serverTimestamp
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';
import { Item, Location as LocationType, SearchFilters } from '../types';

export interface LocationPermissionStatus {
  granted: boolean;
  status: Location.PermissionStatus;
  canAskAgain: boolean;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationSearchOptions {
  radius: number; // in kilometers
  center: LocationCoordinates;
  filters?: Partial<SearchFilters>;
  limit?: number;
}

export interface DeliveryOption {
  type: 'pickup' | 'delivery' | 'meet_in_middle';
  enabled: boolean;
  cost?: number; // in cents
  radius?: number; // in kilometers for delivery
  instructions?: string;
}

export interface LocationService {
  // Permission management
  requestLocationPermission(): Promise<LocationPermissionStatus>;
  getCurrentLocation(): Promise<LocationCoordinates | null>;
  
  // Search and discovery
  searchNearbyItems(options: LocationSearchOptions): Promise<Item[]>;
  calculateDistance(from: LocationCoordinates, to: LocationCoordinates): number;
  
  // Address and geocoding
  geocodeAddress(address: string): Promise<LocationCoordinates | null>;
  reverseGeocode(coordinates: LocationCoordinates): Promise<string | null>;
  
  // Delivery options
  getDeliveryOptions(itemId: string): Promise<DeliveryOption[]>;
  calculateDeliveryFee(from: LocationCoordinates, to: LocationCoordinates, itemId: string): Promise<number>;
  
  // GPS tracking
  startLocationTracking(rentalId: string): Promise<void>;
  stopLocationTracking(rentalId: string): Promise<void>;
  updateRentalLocation(rentalId: string, location: LocationCoordinates): Promise<void>;
}

export class LocationServiceImpl implements LocationService {
  private static instance: LocationServiceImpl;
  private watchId: Location.LocationSubscription | null = null;
  private trackingRentals: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): LocationServiceImpl {
    if (!LocationServiceImpl.instance) {
      LocationServiceImpl.instance = new LocationServiceImpl();
    }
    return LocationServiceImpl.instance;
  }

  // Request location permission
  public async requestLocationPermission(): Promise<LocationPermissionStatus> {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      
      return {
        granted: status === 'granted',
        status,
        canAskAgain,
      };
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return {
        granted: false,
        status: Location.PermissionStatus.DENIED,
        canAskAgain: false,
      };
    }
  }

  // Get current user location
  public async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      const permission = await this.requestLocationPermission();
      
      if (!permission.granted) {
        throw new Error('Location permission not granted');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 10,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  // Search for items near a location
  public async searchNearbyItems(options: LocationSearchOptions): Promise<Item[]> {
    try {
      // Calculate bounding box for approximate location filtering
      const boundingBox = this.calculateBoundingBox(options.center, options.radius);
      
      let q = query(
        collection(db, collections.items),
        where('status', '==', 'active'),
        where('location.latitude', '>=', boundingBox.minLat),
        where('location.latitude', '<=', boundingBox.maxLat)
      );

      // Apply additional filters
      if (options.filters?.category) {
        q = query(q, where('category', '==', options.filters.category));
      }

      if (options.filters?.priceRange) {
        q = query(q, where('pricing.dailyRate', '>=', options.filters.priceRange.min));
        q = query(q, where('pricing.dailyRate', '<=', options.filters.priceRange.max));
      }

      if (options.limit) {
        q = query(q, limit(options.limit));
      }

      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Item[];

      // Filter by precise distance and sort by distance
      const itemsWithDistance = items
        .map(item => ({
          item,
          distance: this.calculateDistance(options.center, {
            latitude: item.location.latitude,
            longitude: item.location.longitude,
          }),
        }))
        .filter(({ distance }) => distance <= options.radius)
        .sort((a, b) => a.distance - b.distance)
        .map(({ item }) => item);

      return itemsWithDistance;
    } catch (error) {
      console.error('Error searching nearby items:', error);
      throw new Error('Failed to search nearby items');
    }
  }

  // Calculate distance between two coordinates using Haversine formula
  public calculateDistance(from: LocationCoordinates, to: LocationCoordinates): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) * Math.cos(this.toRadians(to.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Convert address to coordinates
  public async geocodeAddress(address: string): Promise<LocationCoordinates | null> {
    try {
      const results = await Location.geocodeAsync(address);
      
      if (results.length > 0) {
        const result = results[0];
        return {
          latitude: result.latitude,
          longitude: result.longitude,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }

  // Convert coordinates to address
  public async reverseGeocode(coordinates: LocationCoordinates): Promise<string | null> {
    try {
      const results = await Location.reverseGeocodeAsync(coordinates);
      
      if (results.length > 0) {
        const result = results[0];
        const addressParts = [
          result.streetNumber,
          result.street,
          result.city,
          result.region,
          result.country,
        ].filter(Boolean);
        
        return addressParts.join(', ');
      }
      
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  // Get delivery options for an item
  public async getDeliveryOptions(itemId: string): Promise<DeliveryOption[]> {
    try {
      const itemDoc = await getDoc(doc(db, collections.items, itemId));
      
      if (!itemDoc.exists()) {
        throw new Error('Item not found');
      }

      const item = itemDoc.data() as Item;
      const deliveryOptions = item.location.deliveryOptions;

      const options: DeliveryOption[] = [];

      if (deliveryOptions.pickup) {
        options.push({
          type: 'pickup',
          enabled: true,
          cost: 0,
          instructions: item.location.pickupInstructions,
        });
      }

      if (deliveryOptions.delivery) {
        options.push({
          type: 'delivery',
          enabled: true,
          cost: deliveryOptions.deliveryFee || 0,
          radius: deliveryOptions.deliveryRadius,
        });
      }

      if (deliveryOptions.meetInMiddle) {
        options.push({
          type: 'meet_in_middle',
          enabled: true,
          cost: 0,
        });
      }

      return options;
    } catch (error) {
      console.error('Error getting delivery options:', error);
      throw new Error('Failed to get delivery options');
    }
  }

  // Calculate delivery fee based on distance
  public async calculateDeliveryFee(
    from: LocationCoordinates,
    to: LocationCoordinates,
    itemId: string
  ): Promise<number> {
    try {
      const distance = this.calculateDistance(from, to);
      const deliveryOptions = await this.getDeliveryOptions(itemId);
      
      const deliveryOption = deliveryOptions.find(opt => opt.type === 'delivery');
      
      if (!deliveryOption || !deliveryOption.enabled) {
        throw new Error('Delivery not available for this item');
      }

      // Check if within delivery radius
      if (deliveryOption.radius && distance > deliveryOption.radius) {
        throw new Error('Location outside delivery radius');
      }

      // Base delivery fee + distance-based calculation
      const baseFee = deliveryOption.cost || 0;
      const distanceFee = Math.ceil(distance) * 100; // $1 per km in cents
      
      return baseFee + distanceFee;
    } catch (error) {
      console.error('Error calculating delivery fee:', error);
      throw error;
    }
  }

  // Start GPS tracking for rental handoff
  public async startLocationTracking(rentalId: string): Promise<void> {
    try {
      const permission = await this.requestLocationPermission();
      
      if (!permission.granted) {
        throw new Error('Location permission required for tracking');
      }

      this.trackingRentals.add(rentalId);

      // Start watching location changes
      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000, // Update every 30 seconds
          distanceInterval: 50, // Update every 50 meters
        },
        (location) => {
          if (this.trackingRentals.has(rentalId)) {
            this.updateRentalLocation(rentalId, {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || undefined,
            });
          }
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw new Error('Failed to start location tracking');
    }
  }

  // Stop GPS tracking for rental
  public async stopLocationTracking(rentalId: string): Promise<void> {
    try {
      this.trackingRentals.delete(rentalId);

      // If no more rentals being tracked, stop watching
      if (this.trackingRentals.size === 0 && this.watchId) {
        this.watchId.remove();
        this.watchId = null;
      }
    } catch (error) {
      console.error('Error stopping location tracking:', error);
      throw new Error('Failed to stop location tracking');
    }
  }

  // Update rental location in database
  public async updateRentalLocation(rentalId: string, location: LocationCoordinates): Promise<void> {
    try {
      const rentalRef = doc(db, collections.rentals, rentalId);
      
      await updateDoc(rentalRef, {
        'delivery.currentLocation': {
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating rental location:', error);
      throw new Error('Failed to update rental location');
    }
  }

  // Helper methods
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateBoundingBox(center: LocationCoordinates, radiusKm: number): {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } {
    // Approximate degrees per kilometer
    const latDegreesPerKm = 1 / 111;
    const lonDegreesPerKm = 1 / (111 * Math.cos(this.toRadians(center.latitude)));

    return {
      minLat: center.latitude - (radiusKm * latDegreesPerKm),
      maxLat: center.latitude + (radiusKm * latDegreesPerKm),
      minLon: center.longitude - (radiusKm * lonDegreesPerKm),
      maxLon: center.longitude + (radiusKm * lonDegreesPerKm),
    };
  }

  // Get popular locations for suggestions
  public async getPopularLocations(limit: number = 10): Promise<string[]> {
    try {
      // In a real implementation, this would aggregate popular locations
      // For now, return common city names as suggestions
      return [
        'New York, NY',
        'Los Angeles, CA',
        'Chicago, IL',
        'Houston, TX',
        'Phoenix, AZ',
        'Philadelphia, PA',
        'San Antonio, TX',
        'San Diego, CA',
        'Dallas, TX',
        'San Jose, CA',
      ].slice(0, limit);
    } catch (error) {
      console.error('Error getting popular locations:', error);
      return [];
    }
  }

  // Check if location is within service area
  public isLocationInServiceArea(location: LocationCoordinates): boolean {
    // For MVP, all locations are supported
    // In production, you might check against a list of supported cities/regions
    return true;
  }

  // Get estimated travel time between locations
  public async getEstimatedTravelTime(
    from: LocationCoordinates,
    to: LocationCoordinates,
    mode: 'driving' | 'walking' | 'transit' = 'driving'
  ): Promise<number> {
    try {
      const distance = this.calculateDistance(from, to);
      
      // Rough estimates based on mode of transport
      const speeds = {
        walking: 5, // km/h
        driving: 50, // km/h accounting for city traffic
        transit: 30, // km/h average for public transport
      };

      const timeInHours = distance / speeds[mode];
      return Math.ceil(timeInHours * 60); // Return minutes
    } catch (error) {
      console.error('Error calculating travel time:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const locationService = LocationServiceImpl.getInstance();

// Convenience hook
export const useLocation = () => {
  return {
    requestLocationPermission: locationService.requestLocationPermission.bind(locationService),
    getCurrentLocation: locationService.getCurrentLocation.bind(locationService),
    searchNearbyItems: locationService.searchNearbyItems.bind(locationService),
    calculateDistance: locationService.calculateDistance.bind(locationService),
    geocodeAddress: locationService.geocodeAddress.bind(locationService),
    reverseGeocode: locationService.reverseGeocode.bind(locationService),
    getDeliveryOptions: locationService.getDeliveryOptions.bind(locationService),
    calculateDeliveryFee: locationService.calculateDeliveryFee.bind(locationService),
    startLocationTracking: locationService.startLocationTracking.bind(locationService),
    stopLocationTracking: locationService.stopLocationTracking.bind(locationService),
    getPopularLocations: locationService.getPopularLocations.bind(locationService),
    isLocationInServiceArea: locationService.isLocationInServiceArea.bind(locationService),
    getEstimatedTravelTime: locationService.getEstimatedTravelTime.bind(locationService),
  };
};

export default locationService;
