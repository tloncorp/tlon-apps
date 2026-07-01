import { Blob } from 'expo-blob';
import { fetch as expoFetch } from 'expo/fetch';

// Kept as a function for parity with the web polyfills entrypoint (a no-op
// there) so the shared client setup can call it on both platforms. On native it
// installs expo-blob's spec-compliant Blob as the global: expo/fetch (the global
// fetch) and our upload paths construct blobs from binary data, which React
// Native's built-in Blob rejects.
export const initializePolyfills = () => {
  globalThis.Blob = Blob as unknown as typeof globalThis.Blob;
};

// expo/fetch is a native streaming fetch (Response.body as a ReadableStream),
// used only for the Urbit SSE channel (apiFetch routes text/event-stream here).
// Cast to the standard fetch type — the channel always passes a string URL.
export const platformFetch = expoFetch as unknown as typeof fetch;
