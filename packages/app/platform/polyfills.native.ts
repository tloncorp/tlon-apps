import { fetch as expoFetch } from 'expo/fetch';

// Expo's winter runtime installs expo/fetch as the global `fetch`, and its
// Response.blob() builds `new Blob([ArrayBuffer])` — unsupported by React
// Native's Blob — so every global fetch().blob() (image upload, Urbit HTTP)
// throws. Restore React Native's XHR-backed fetch, whose .blob() works, as the
// global. expo/fetch is used only for the SSE channel, via platformFetch below.
// TextEncoder (Hermes) and TextDecoder + ReadableStream (winter + Metro globals)
// come from the platform, so no encoding/stream polyfills are needed here.
export const initializePolyfills = () => {
  // whatwg-fetch ships no type declarations and is already bundled by React
  // Native (Libraries/Network/fetch); require it for its fetch implementation.
  globalThis.fetch = require('whatwg-fetch').fetch as typeof fetch;
};

// expo/fetch is a native streaming fetch (Response.body as a ReadableStream),
// used only for the Urbit SSE channel (apiFetch routes text/event-stream here).
// Cast to the standard fetch type — the channel always passes a string URL.
export const platformFetch = expoFetch as unknown as typeof fetch;
