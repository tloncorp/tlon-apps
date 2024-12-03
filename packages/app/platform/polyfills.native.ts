//@ts-expect-error no typedefs
import { fetch as streamingFetch } from 'react-native-fetch-api';
//@ts-expect-error no typedefs
import { polyfill as polyfillEncoding } from 'react-native-polyfill-globals/src/encoding';
//@ts-expect-error no typedefs
import { polyfill as polyfillReadableStream } from 'react-native-polyfill-globals/src/readable-stream';

export const initializePolyfills = () => {
  polyfillReadableStream();
  polyfillEncoding();
}

export const platformFetch = streamingFetch;
