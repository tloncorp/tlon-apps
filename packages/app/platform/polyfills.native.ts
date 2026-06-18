import { fetch as expoFetch } from 'expo/fetch';
//@ts-expect-error no typedefs
import { polyfill as polyfillEncoding } from 'react-native-polyfill-globals/src/encoding';
//@ts-expect-error no typedefs
import { polyfill as polyfillReadableStream } from 'react-native-polyfill-globals/src/readable-stream';

export const initializePolyfills = () => {
  polyfillReadableStream();
  polyfillEncoding();
};

// expo/fetch is a native streaming fetch (Response.body as a ReadableStream),
// used only for the Urbit SSE channel (apiFetch routes text/event-stream here).
// Cast to the standard fetch type — the channel always passes a string URL.
export const platformFetch = expoFetch as unknown as typeof fetch;
