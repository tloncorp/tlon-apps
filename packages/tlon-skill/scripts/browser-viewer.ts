import {
  isTrustedBrowserViewerHost,
  isBrowserViewerDevelopmentOrigin,
  MAX_BROWSER_VIEWER_URL_LENGTH,
} from '@tloncorp/api/client/browserSession';

import { commandError } from './commands/command';

export function validateBrowserViewerUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw commandError('viewer URL is invalid');
  }

  if (url.toString().length > MAX_BROWSER_VIEWER_URL_LENGTH) {
    throw commandError(
      `viewer URL must not exceed ${MAX_BROWSER_VIEWER_URL_LENGTH} characters`
    );
  }

  if (
    (!isBrowserViewerDevelopmentOrigin(
      url,
      process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN
    ) &&
      (url.protocol !== 'https:' ||
        !isTrustedBrowserViewerHost(url.hostname))) ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/s\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(url.pathname)
  ) {
    throw commandError(
      'viewer URL must be a signed URL on a trusted Tlon browser viewer host'
    );
  }

  return url.toString();
}
