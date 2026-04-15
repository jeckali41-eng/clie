import { useState, useEffect, useCallback, useRef } from 'react';
import { rideService, RideOption } from '../services/rideService';

interface UseRideOptionsProps {
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  discountPercent?: number;
  enabled?: boolean;
}

interface UseRideOptionsReturn {
  rideOptions: RideOption[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRideOptions({
  pickupLat,
  pickupLng,
  destinationLat,
  destinationLng,
  discountPercent = 0,
  enabled = true
}: UseRideOptionsProps): UseRideOptionsReturn {
  const [rideOptions, setRideOptions] = useState<RideOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const driversUnsubscribeRef = useRef<(() => void) | null>(null);
  const locationsUnsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  const buildOptions = useCallback(async () => {
    if (!enabled) return;
    
    try {
      const options = await rideService.buildRideOptions(
        pickupLat,
        pickupLng,
        destinationLat,
        destinationLng,
        discountPercent
      );
      
      if (isMountedRef.current) {
        setRideOptions(options);
        setError(null);
      }
    } catch (err) {
      console.error('Error building ride options:', err);
      if (isMountedRef.current) {
        setError('Failed to load ride options');
      }
    }
  }, [pickupLat, pickupLng, destinationLat, destinationLng, discountPercent, enabled]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await buildOptions();
    setIsLoading(false);
  }, [buildOptions]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Start listening to online drivers
    driversUnsubscribeRef.current = rideService.startDriversListener(async () => {
      // Rebuild options when drivers change
      await buildOptions();
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    });

    // Start listening to driver locations
    locationsUnsubscribeRef.current = rideService.startLocationsListener(async () => {
      // Rebuild options when locations change (for ETA updates)
      await buildOptions();
    });

    // Initial build
    buildOptions().then(() => {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      
      // Cleanup listeners
      if (driversUnsubscribeRef.current) {
        driversUnsubscribeRef.current();
        driversUnsubscribeRef.current = null;
      }
      if (locationsUnsubscribeRef.current) {
        locationsUnsubscribeRef.current();
        locationsUnsubscribeRef.current = null;
      }
    };
  }, [enabled, buildOptions]);

  return {
    rideOptions,
    isLoading,
    error,
    refresh
  };
}
