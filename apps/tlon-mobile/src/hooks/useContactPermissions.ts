import * as Contacts from 'expo-contacts';
import { useEffect, useState } from 'react';

export type ContactPermissionStatus =
  | 'undetermined' // Initial state, not yet requested
  | 'denied' // User denied permission
  | 'granted' // User granted permission
  | 'loading'; // Currently checking status

export function useContactPermissions() {
  const [status, setStatus] = useState<ContactPermissionStatus>('loading');

  // Check initial permission status on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  // Function to check current permission status
  const checkPermissions = async () => {
    try {
      setStatus('loading');
      const { status } = await Contacts.getPermissionsAsync();
      setStatus(status);
    } catch (error) {
      console.error('Error checking contact permissions:', error);
      setStatus('undetermined');
    }
  };

  // Function to request permissions
  const requestPermissions = async () => {
    try {
      setStatus('loading');
      console.log('initiating perms request');
      const { status } = await Contacts.requestPermissionsAsync();
      setStatus(status);
      return status;
    } catch (error) {
      console.error('Error requesting contact permissions:', error);
      setStatus('undetermined');
      return 'undetermined';
    }
  };

  // Helper properties for permission states
  const hasPermission = status === 'granted';
  const canAskPermission = status === 'undetermined';
  const permissionDenied = status === 'denied';
  const isLoading = status === 'loading';

  return {
    status,
    hasPermission,
    canAskPermission,
    permissionDenied,
    isLoading,
    checkPermissions,
    requestPermissions,
  };
}
