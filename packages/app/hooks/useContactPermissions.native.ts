import * as Contacts from 'expo-contacts';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

export type ContactPermissionStatus =
  | 'undetermined' // Initial state, not yet requested
  | 'denied' // User denied permission
  | 'granted' // User granted permission
  | 'loading'; // Currently checking status

export type ContactPermissionAccessPrivileges =
  | 'all'
  | 'limited'
  | 'none'
  | 'undetermined';

export function useContactPermissions() {
  const [status, setStatus] = useState<ContactPermissionStatus>('loading');

  useEffect(() => {
    checkPermissions();
  }, []);

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

  const requestPermissions = async () => {
    try {
      const { status: startStatus } = await Contacts.getPermissionsAsync();
      if (startStatus !== 'undetermined') {
        setStatus(startStatus);
        return startStatus;
      }

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

  const openSettings = useCallback(async () => {
    Linking.openSettings();
  }, []);

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
    openSettings,
  };
}
