import { Blob } from 'expo-blob';

// Kept as a function for parity with the web polyfills entrypoint (a no-op
// there) so the shared client setup can call it on both platforms. On native it
// installs expo-blob's spec-compliant Blob as the global: expo/fetch (the global
// fetch since SDK 56's winter runtime) and our upload paths construct blobs
// from binary data, which React Native's built-in Blob rejects.
export const initializePolyfills = () => {
  globalThis.Blob = Blob as unknown as typeof globalThis.Blob;
};
