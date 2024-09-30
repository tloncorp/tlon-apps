import * as api from '@tloncorp/shared/dist/api';
import { ChannelStatus } from '@urbit/http-api';
//@ts-expect-error no typedefs
import { fetch as streamingFetch } from 'react-native-fetch-api';
//@ts-expect-error no typedefs
import { polyfill as polyfillEncoding } from 'react-native-polyfill-globals/src/encoding';
//@ts-expect-error no typedefs
import { polyfill as polyfillReadableStream } from 'react-native-polyfill-globals/src/readable-stream';

polyfillReadableStream();
polyfillEncoding();

let abortController = new AbortController();

const apiFetch: typeof fetch = (input, { ...init } = {}) => {
  // Wire our injected AbortController up to the one passed in by the client.
  if (init.signal) {
    init.signal.onabort = () => {
      abortController.abort();
      abortController = new AbortController();
    };
  }

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
    signal: abortController.signal,
    // @ts-expect-error This is used by the SSE polyfill to determine whether
    // to stream the request.
    reactNative: { textStreaming: true },
  };
  return streamingFetch(input, newInit);
};

export const cancelFetch = () => {
  abortController.abort();
  abortController = new AbortController();
};

export function configureClient({
  shipName,
  shipUrl,
  onReset,
  onChannelReset,
  onChannelStatusChange,
  verbose,
}: {
  shipName: string;
  shipUrl: string;
  onReset?: () => void;
  onChannelReset?: () => void;
  onChannelStatusChange?: (status: ChannelStatus) => void;
  verbose?: boolean;
}) {
  api.configureClient({
    shipName,
    shipUrl,
    fetchFn: apiFetch,
    onReset,
    onChannelReset,
    onChannelStatusChange,
    verbose,
  });
}
