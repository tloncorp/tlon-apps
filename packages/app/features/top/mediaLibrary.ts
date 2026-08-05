// expo-media-library is native-only; mediaLibrary.web.ts is a stub.
export * from 'expo-media-library';
// SDK 56's expo-media-library no longer re-exports PermissionStatus; it lives
// in expo-modules-core (web stub mirrors this).
export { PermissionStatus } from 'expo-modules-core';
