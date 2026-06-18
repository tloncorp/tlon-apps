import { fetch as expoFetch } from 'expo/fetch';

// TextEncoder (Hermes), and TextDecoder + ReadableStream (Expo's winter runtime
// and Metro globals) are provided by the platform, so no fetch/encoding
// polyfills are needed here. No-op, kept for parity with polyfills.ts (web).
export const initializePolyfills = () => {
  // no-op
};

// expo/fetch is a native streaming fetch (Response.body as a ReadableStream),
// used only for the Urbit SSE channel (apiFetch routes text/event-stream here).
// Cast to the standard fetch type — the channel always passes a string URL.
export const platformFetch = expoFetch as unknown as typeof fetch;
