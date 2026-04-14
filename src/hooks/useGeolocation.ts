
import { useState, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  loading: boolean;
  error: string | null;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    address: null,
    loading: true,
    error: null
  });

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    // Mock reverse geocoding - in production, use Google Maps Geocoding API
    const mockAddresses = [
      '49 Cornwell Street, West Turffontein, Johannesburg',
      '34 Beaumont Street, Marshalltown, Johannesburg',
      '78 Eastwood Street, West Turffontein, Johannesburg',
      '92 Beaumont Street, West Turffontein, Johannesburg'
    ];
    
    return mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by this browser'
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const address = await reverseGeocode(latitude, longitude);
          setLocation({
            latitude,
            longitude,
            address,
            loading: false,
            error: null
          });
        } catch (error) {
          setLocation(prev => ({
            ...prev,
            latitude,
            longitude,
            loading: false,
            error: 'Failed to get address'
          }));
        }
      },
      (error) => {
        setLocation(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  }, []);

  return location;
};