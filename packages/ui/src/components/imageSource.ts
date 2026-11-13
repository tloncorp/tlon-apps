import { createDevLogger } from '@tloncorp/shared';
import { isDataURI, isURL } from 'validator';

const logger = createDevLogger('Image', false);

export function isValidImageSource(source: any) {
  try {
    if (!source) return false;
    const uri: string = typeof source === 'object' ? source.uri : source;
    if (!uri) {
      return false;
    }

    if (typeof uri === 'number') {
      // this is the case for imports of bundled files (require() returns a numeric metro module ID)
      return true;
    }

    if (
      typeof uri === 'string' &&
      (uri.startsWith('file:') || uri.startsWith('blob:'))
    ) {
      // permit file URIs
      return true;
    }

    if (
      typeof uri === 'string' &&
      (uri.startsWith('./') || uri.startsWith('/'))
    ) {
      // permit relative paths (for web public assets)
      return true;
    }

    // A server reached as `localhost` has no top-level domain; the
    // validator rejects such hosts unless told otherwise.
    return isURL(uri, { require_tld: false }) || isDataURI(uri);
  } catch (e) {
    logger.trackError('Failed to validate image source', {
      source,
      error: e,
    });
  }
  return false;
}
