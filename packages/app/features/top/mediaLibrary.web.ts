// Web stub for the native-only expo-media-library; never invoked on web
// (MediaViewerScreen guards every call site with `if (isWeb)`).
export { PermissionStatus } from 'expo-modules-core';

export async function requestPermissionsAsync(): Promise<never> {
  throw new Error('expo-media-library is not available on web');
}

export async function saveToLibraryAsync(_uri: string): Promise<never> {
  throw new Error('expo-media-library is not available on web');
}
