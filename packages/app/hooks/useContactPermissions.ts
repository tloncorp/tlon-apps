// No-op stub for web
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
  const checkPermissions = async () => {
    // No-op for web - always returns undetermined
    return 'undetermined';
  };

  const requestPermissions = async () => {
    // No-op for web - always returns undetermined
    console.log('Contact permissions not available on web');
    return 'undetermined' as ContactPermissionStatus;
  };

  const openSettings = async () => {
    // No-op for web - always returns undetermined
    console.log('Cannot open settings on web');
  };

  // These values are consistent with the undetermined state
  const hasPermission = false;
  const canAskPermission = false;
  const permissionDenied = false;
  const isLoading = false;

  return {
    status: 'denied',
    hasPermission,
    canAskPermission,
    permissionDenied,
    isLoading,
    checkPermissions,
    requestPermissions,
    openSettings,
  };
}
