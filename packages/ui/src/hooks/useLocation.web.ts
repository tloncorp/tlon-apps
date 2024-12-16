export function useLocation() {
  console.error('Location is not available on web');
  return {
    isAvailable: false,
    canRequest: false,
    requestPermission: () => {},
    openSettings: () => {},
    getCurrentLocation: () => {},
  };
}
