import { db, database } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  serverTimestamp,
  onSnapshot,
  DocumentData
} from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { calculateDistance } from '../utils/etaCalculation';

// Display name mapping for pricing types
export const PRICING_DISPLAY_NAMES: Record<string, string> = {
  'ride_economy': 'Economy',
  'ride_comfort': 'Comfort',
  'ride_women': 'Women to Women',
  'ride_xl': 'XL',
  'aletwende': 'Aletwende'
};

// Types
export interface PricingConfig {
  id: string;
  name: string;
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
  vehicleCategory?: string;
}

export interface VehicleServiceRule {
  id: string;
  vehicleRef: string;
  pricingTypes: string[];
  services: string[];
}

export interface VehicleMaster {
  id: string;
  vehicleCategory: string;
  maxSeats: number;
  brand?: string;
  model?: string;
}

export interface OnlineDriver {
  driverId: string;
  vehicleCategory: string;
  isOnline: boolean;
  isBusy: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface RideOption {
  id: string;
  pricingId: string;
  name: string;
  displayName: string;
  estimatedPrice: number;
  originalPrice: number;
  eta: string;
  etaMinutes: number;
  vehicleCategory: string;
  seats: number;
  isAvailable: boolean;
  nearestDriverId?: string;
}

export interface RideRequestData {
  userId: string;
  userName: string;
  userEmail?: string;
  pickupLocation: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  destinationLocation: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  stops?: string[];
  pricingId: string;
  service: string;
  status: 'pending' | 'accepted' | 'arrived' | 'started' | 'completed' | 'cancelled';
  estimatedPrice: number;
  vehicleCategory: string;
  seats: number;
  createdAt?: any;
}

class RideService {
  // Cache for pricing data
  private pricingCache: Map<string, PricingConfig> = new Map();
  private vehicleRulesCache: VehicleServiceRule[] = [];
  private vehiclesCache: Map<string, VehicleMaster> = new Map();
  private onlineDriversCache: Map<string, OnlineDriver> = new Map();
  private driverLocationsCache: Map<string, { lat: number; lng: number }> = new Map();
  
  // Listeners
  private driversListener: (() => void) | null = null;
  private locationsListener: (() => void) | null = null;

  /**
   * Fetch vehicle service rules where services array contains "ride"
   */
  async fetchVehicleServiceRules(): Promise<VehicleServiceRule[]> {
    try {
      const rulesRef = collection(db, 'vehicle_service_rules');
      const q = query(rulesRef, where('services', 'array-contains', 'ride'));
      const snapshot = await getDocs(q);
      
      this.vehicleRulesCache = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as VehicleServiceRule));
      
      return this.vehicleRulesCache;
    } catch (error) {
      console.error('Error fetching vehicle service rules:', error);
      return [];
    }
  }

  /**
   * Fetch vehicle master data by reference ID
   */
  async fetchVehicleMaster(vehicleId: string): Promise<VehicleMaster | null> {
    // Check cache first
    if (this.vehiclesCache.has(vehicleId)) {
      return this.vehiclesCache.get(vehicleId)!;
    }

    try {
      const vehicleRef = doc(db, 'vehicles_master', vehicleId);
      const snapshot = await getDoc(vehicleRef);
      
      if (snapshot.exists()) {
        const vehicle: VehicleMaster = {
          id: snapshot.id,
          ...snapshot.data() as Omit<VehicleMaster, 'id'>
        };
        this.vehiclesCache.set(vehicleId, vehicle);
        return vehicle;
      }
      return null;
    } catch (error) {
      console.error('Error fetching vehicle master:', error);
      return null;
    }
  }

  /**
   * Fetch pricing config by ID
   */
  async fetchPricingConfig(pricingId: string): Promise<PricingConfig | null> {
    // Check cache first
    if (this.pricingCache.has(pricingId)) {
      return this.pricingCache.get(pricingId)!;
    }

    try {
      const pricingRef = doc(db, 'pricing', pricingId);
      const snapshot = await getDoc(pricingRef);
      
      if (snapshot.exists()) {
        const pricing: PricingConfig = {
          id: snapshot.id,
          ...snapshot.data() as Omit<PricingConfig, 'id'>
        };
        this.pricingCache.set(pricingId, pricing);
        return pricing;
      }
      return null;
    } catch (error) {
      console.error('Error fetching pricing config:', error);
      return null;
    }
  }

  /**
   * Calculate price based on pricing config and distance
   */
  calculatePrice(pricing: PricingConfig, distanceKm: number, durationMinutes: number): number {
    const distancePrice = pricing.pricePerKm * distanceKm;
    const timePrice = pricing.pricePerMinute * durationMinutes;
    const calculatedPrice = pricing.baseFare + distancePrice + timePrice;
    
    return Math.max(Math.round(calculatedPrice), pricing.minimumFare);
  }

  /**
   * Start listening to online drivers (Realtime DB)
   */
  startDriversListener(callback: (drivers: Map<string, OnlineDriver>) => void): () => void {
    const driversRef = ref(database, 'drivers_online');
    
    const unsubscribe = onValue(driversRef, (snapshot) => {
      const data = snapshot.val();
      this.onlineDriversCache.clear();
      
      if (data) {
        Object.entries(data).forEach(([driverId, driverData]) => {
          const driver = driverData as any;
          if (driver.isOnline === true && driver.isBusy === false) {
            this.onlineDriversCache.set(driverId, {
              driverId,
              vehicleCategory: driver.vehicleCategory || '',
              isOnline: driver.isOnline,
              isBusy: driver.isBusy
            });
          }
        });
      }
      
      callback(this.onlineDriversCache);
    });

    this.driversListener = () => off(driversRef, 'value', unsubscribe);
    return this.driversListener;
  }

  /**
   * Start listening to driver locations (Realtime DB)
   */
  startLocationsListener(callback: (locations: Map<string, { lat: number; lng: number }>) => void): () => void {
    const locationsRef = ref(database, 'driver_locations');
    
    const unsubscribe = onValue(locationsRef, (snapshot) => {
      const data = snapshot.val();
      this.driverLocationsCache.clear();
      
      if (data) {
        Object.entries(data).forEach(([driverId, locationData]) => {
          const loc = locationData as any;
          // Handle GeoFire format: { l: [lat, lng], g: geohash }
          if (loc.l && Array.isArray(loc.l) && loc.l.length >= 2) {
            this.driverLocationsCache.set(driverId, {
              lat: loc.l[0],
              lng: loc.l[1]
            });
          } else if (loc.lat !== undefined && loc.lng !== undefined) {
            this.driverLocationsCache.set(driverId, {
              lat: loc.lat,
              lng: loc.lng
            });
          }
        });
      }
      
      callback(this.driverLocationsCache);
    });

    this.locationsListener = () => off(locationsRef, 'value', unsubscribe);
    return this.locationsListener;
  }

  /**
   * Find nearest driver for a vehicle category
   */
  findNearestDriver(
    vehicleCategory: string,
    pickupLat: number,
    pickupLng: number
  ): { driverId: string; distance: number; etaMinutes: number } | null {
    let nearestDriver: { driverId: string; distance: number; etaMinutes: number } | null = null;
    let minDistance = Infinity;

    this.onlineDriversCache.forEach((driver, driverId) => {
      // Match vehicle category
      if (driver.vehicleCategory === vehicleCategory || !vehicleCategory) {
        const location = this.driverLocationsCache.get(driverId);
        if (location) {
          const distance = calculateDistance(pickupLat, pickupLng, location.lat, location.lng);
          if (distance < minDistance) {
            minDistance = distance;
            // Assume average speed of 35 km/h in city
            const etaMinutes = Math.max(1, Math.round((distance / 35) * 60));
            nearestDriver = { driverId, distance, etaMinutes };
          }
        }
      }
    });

    return nearestDriver;
  }

  /**
   * Build ride options from Firestore data + Realtime driver data
   */
  async buildRideOptions(
    pickupLat: number | null,
    pickupLng: number | null,
    destinationLat: number | null,
    destinationLng: number | null,
    discountPercent: number = 0
  ): Promise<RideOption[]> {
    const rideOptions: RideOption[] = [];

    // Fetch vehicle service rules for "ride" service
    const vehicleRules = await this.fetchVehicleServiceRules();

    // Calculate trip distance (approximate)
    let tripDistanceKm = 8; // Default
    let tripDurationMinutes = 15; // Default
    
    if (pickupLat && pickupLng && destinationLat && destinationLng) {
      tripDistanceKm = calculateDistance(pickupLat, pickupLng, destinationLat, destinationLng);
      tripDurationMinutes = Math.round((tripDistanceKm / 35) * 60); // 35 km/h average
    }

    // Process each vehicle rule
    for (const rule of vehicleRules) {
      // Fetch vehicle master data
      const vehicle = await this.fetchVehicleMaster(rule.vehicleRef);
      if (!vehicle) continue;

      // Process each pricing type for this vehicle
      for (const pricingId of rule.pricingTypes) {
        const pricing = await this.fetchPricingConfig(pricingId);
        if (!pricing) continue;

        // Calculate estimated price
        const fullPrice = this.calculatePrice(pricing, tripDistanceKm, tripDurationMinutes);
        const discountedPrice = discountPercent > 0 
          ? Math.round(fullPrice * (1 - discountPercent / 100))
          : fullPrice;

        // Find nearest available driver
        const nearestDriver = pickupLat && pickupLng 
          ? this.findNearestDriver(vehicle.vehicleCategory, pickupLat, pickupLng)
          : null;

        const isAvailable = nearestDriver !== null;
        const etaMinutes = nearestDriver?.etaMinutes || 0;

        rideOptions.push({
          id: `${pricingId}_${rule.id}`,
          pricingId,
          name: pricing.name || pricingId,
          displayName: PRICING_DISPLAY_NAMES[pricingId] || pricing.name || pricingId,
          estimatedPrice: discountedPrice,
          originalPrice: fullPrice,
          eta: isAvailable ? `${etaMinutes} min` : 'No drivers',
          etaMinutes,
          vehicleCategory: vehicle.vehicleCategory,
          seats: vehicle.maxSeats,
          isAvailable,
          nearestDriverId: nearestDriver?.driverId
        });
      }
    }

    // Sort by availability first, then by price
    rideOptions.sort((a, b) => {
      if (a.isAvailable && !b.isAvailable) return -1;
      if (!a.isAvailable && b.isAvailable) return 1;
      return a.estimatedPrice - b.estimatedPrice;
    });

    return rideOptions;
  }

  /**
   * Create ride request in Firestore
   * Creates BOTH rideRequests and rides documents
   */
  async createRideRequest(data: RideRequestData): Promise<string> {
    try {
      // Generate a unique ride ID
      const rideId = `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create rideRequests document
      const rideRequestsRef = collection(db, 'rideRequests');
      await addDoc(rideRequestsRef, {
        ...data,
        rideId,
        createdAt: serverTimestamp()
      });

      // Create rides document
      const ridesRef = collection(db, 'rides');
      const rideDocRef = await addDoc(ridesRef, {
        ...data,
        rideId,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      return rideDocRef.id;
    } catch (error) {
      console.error('Error creating ride request:', error);
      throw error;
    }
  }

  /**
   * Listen to ride status changes in Firestore
   */
  listenToRide(
    rideId: string,
    callback: (rideData: DocumentData | null) => void
  ): () => void {
    const rideRef = doc(db, 'rides', rideId);
    
    const unsubscribe = onSnapshot(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });

    return unsubscribe;
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    if (this.driversListener) {
      this.driversListener();
      this.driversListener = null;
    }
    if (this.locationsListener) {
      this.locationsListener();
      this.locationsListener = null;
    }
  }
}

export const rideService = new RideService();
