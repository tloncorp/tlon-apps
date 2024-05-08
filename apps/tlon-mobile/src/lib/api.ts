import * as api from '@tloncorp/shared/dist/api';
//@ts-expect-error no typedefs
import { fetch as streamingFetch } from 'react-native-fetch-api';
//@ts-expect-error no typedefs
import { polyfill as polyfillEncoding } from 'react-native-polyfill-globals/src/encoding';
//@ts-expect-error no typedefs
import { polyfill as polyfillReadableStream } from 'react-native-polyfill-globals/src/readable-stream';

polyfillReadableStream();
polyfillEncoding();

const apiFetch: typeof fetch = (input, { ...init } = {}) => {
  const headers = new Headers(init.headers);
  // The urbit client is inconsistent about sending cookies, sometimes causing
  // the server to send back a new, anonymous, cookie, which is sent on all
  // subsequent requests and screws everything up. This ensures that explicit
  // cookie headers are never set, delegating all cookie handling to the
  // native http client.
  headers.delete('Cookie');
  headers.delete('cookie');
  const newInit: RequestInit = {
    ...init,
    headers,
    // Avoid setting credentials method for same reason as above.
    credentials: undefined,
    // @ts-expect-error This is used by the SSE polyfill to determine whether
    // to stream the request.
    reactNative: { textStreaming: true },
  };
  return streamingFetch(input, newInit);
};

export function configureClient(
  shipName: string,
  shipUrl: string,
  onReset?: () => void
) {
  api.configureClient({ shipName, shipUrl, fetchFn: apiFetch, onReset });
}
