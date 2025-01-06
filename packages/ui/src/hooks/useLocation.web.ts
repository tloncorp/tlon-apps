import { useCallback, useEffect, useState } from 'react';

// Web equivalent of Location.PermissionStatus
type PermissionStatus = 'granted' | 'denied' | 'prompt';

interface LocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export function useLocation() {
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus | null>(null);

  useEffect(() => {
    // Check if geolocation is available in the browser
    if (!('geolocation' in navigator)) {
      setPermissionStatus('denied');
      return;
    }

    // Check permission status using Permissions API if available
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((permissionResult) => {
          setPermissionStatus(permissionResult.state as PermissionStatus);

          // Listen for permission changes
          permissionResult.addEventListener('change', () => {
            setPermissionStatus(permissionResult.state as PermissionStatus);
          });
        })
        .catch(() => {
          // Fallback to 'prompt' if Permissions API fails
          setPermissionStatus('prompt');
        });
    } else {
      // Fallback for browsers without Permissions API
      setPermissionStatus('prompt');
    }
  }, []);

  const getCurrentLocation =
    useCallback(async (): Promise<LocationPosition> => {
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation is not supported by this browser');
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const scrambled = scrambleLocation(
              position.coords.latitude,
              position.coords.longitude
            );

            resolve({
              coords: {
                ...position.coords,
                latitude: scrambled.latitude,
                longitude: scrambled.longitude,
                accuracy: 3000, // Set to 3km
              },
              timestamp: position.timestamp,
            });
          },
          (error) => {
            reject(new Error(error.message));
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0,
          }
        );
      });
    }, []);

  const requestPermission = useCallback(async () => {
    if (permissionStatus === 'prompt') {
      try {
        await getCurrentLocation();
        setPermissionStatus('granted');
        return true;
      } catch (error) {
        setPermissionStatus('denied');
        return false;
      }
    }
    return false;
  }, [getCurrentLocation, permissionStatus]);

  const openSettings = useCallback(() => {
    // Open browser settings - this is platform dependent
    // and might not work on all browsers
    if ('chrome' in window) {
      window.open('chrome://settings/content/location');
    } else {
      // For other browsers, we can only guide users
      alert('Please enable location permissions in your browser settings.');
    }
  }, []);

  return {
    isAvailable: permissionStatus === 'granted',
    canRequest: permissionStatus === 'prompt',
    requestPermission,
    openSettings,
    getCurrentLocation,
  };
}

// Reduced location accuracy helpers
const getLatitudePrecision = (): number => {
  // 3km is about 0.027 degrees at the equator
  return 0.027; // This gives us roughly 3km north-south anywhere on Earth
};

const getLongitudePrecision = (latitude: number): number => {
  // At the equator, 0.027 degrees is about 3km
  // As we move away from equator, we need to divide by cos(latitude)
  // to maintain the same distance in km
  const equatorPrecision = 0.027;
  return equatorPrecision / Math.cos((latitude * Math.PI) / 180);
};

const scrambleCoordinate = (coord: number, precision: number): number => {
  // Round to the nearest precision unit
  return Math.round(coord / precision) * precision;
};

export const scrambleLocation = (latitude: number, longitude: number) => {
  const latPrecision = getLatitudePrecision();
  const lonPrecision = getLongitudePrecision(latitude);

  return {
    latitude: scrambleCoordinate(latitude, latPrecision),
    longitude: scrambleCoordinate(longitude, lonPrecision),
  };
};
