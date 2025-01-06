import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

export function useLocation() {
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
    });
  }, [setPermissionStatus]);

  const requestPermission = useCallback(async () => {
    if (permissionStatus === 'undetermined') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      return status === 'granted';
    }
    return false;
  }, [permissionStatus]);

  const openSettings = useCallback(() => {
    return Linking.openSettings();
  }, []);

  const getCurrentLocation = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      throw new Error('Location permission not granted');
    }

    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
    });
  }, [permissionStatus]);

  return {
    isAvailable: permissionStatus === 'granted',
    canRequest: permissionStatus === 'undetermined',
    requestPermission,
    openSettings,
    getCurrentLocation,
  };
}

// type PermissionStatus = 'granted' | 'denied' | 'undetermined';

// // Mock the shape of Location.LocationObject
// interface LocationObject {
//   coords: {
//     latitude: number;
//     longitude: number;
//     altitude: number | null;
//     accuracy: number;
//     altitudeAccuracy: number | null;
//     heading: number | null;
//     speed: number | null;
//   };
//   timestamp: number;
// }

// export function useLocation() {
//   // Always return granted for testing
//   const permissionStatus: PermissionStatus = 'granted';

//   const requestPermission = async () => true;

//   const openSettings = () => Promise.resolve();

//   const getCurrentLocation = async (): Promise<LocationObject> => {
//     // Return a random location within reasonable bounds
//     return {
//       coords: {
//         // Random lat between 25 and 48 (roughly covers continental US)
//         latitude: 25 + Math.random() * 23,
//         // Random lon between -65 and -125 (roughly covers continental US)
//         longitude: -125 + Math.random() * 60,
//         altitude: null,
//         accuracy: 5,
//         altitudeAccuracy: null,
//         heading: null,
//         speed: null,
//       },
//       timestamp: Date.now(),
//     };
//   };

//   return {
//     isAvailable: true,
//     canRequest: false,
//     requestPermission,
//     openSettings,
//     getCurrentLocation,
//   };
// }
