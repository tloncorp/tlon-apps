/**
 * Upload an image from a URL to Tlon storage.
 */
import { uploadFile } from '@tloncorp/api';
import { fetchWithSsrFGuard } from 'openclaw/plugin-sdk/ssrf-runtime';

import { getDefaultSsrFPolicy } from './context.js';

/**
 * Fetch an image from a URL and upload it to Tlon storage.
 * Returns the uploaded URL, or falls back to the original URL on error.
 *
 * Note: configureClient must be called before using this function.
 */
export async function uploadImageFromUrl(imageUrl: string): Promise<string> {
  try {
    // Validate URL is http/https before fetching
    const url = new URL(imageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      console.log(`[tlon] upload: rejected non-http(s) URL: ${imageUrl}`);
      return imageUrl;
    }

    // Fetch the image with SSRF protection
    // Use fetchWithSsrFGuard directly (not urbitFetch) to preserve the full URL path
    const { response, release } = await fetchWithSsrFGuard({
      url: imageUrl,
      init: { method: 'GET' },
      policy: getDefaultSsrFPolicy(),
      auditContext: 'tlon-upload-image',
    });

    try {
      if (!response.ok) {
        console.log(
          `[tlon] upload: failed to fetch image from ${imageUrl}: ${response.status}`
        );
        return imageUrl;
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const blob = await response.blob();

      // Extract filename from URL or use a default
      const urlPath = new URL(imageUrl).pathname;
      const fileName = urlPath.split('/').pop() || `upload-${Date.now()}.png`;

      // Upload to Tlon storage
      const result = await uploadFile({
        blob,
        fileName,
        contentType,
      });

      return result.url;
    } finally {
      await release();
    }
  } catch (err) {
    // console.log, not console.warn: warn-level output from this subsystem
    // does not surface in the harness/CI container logs, which made upload
    // failures fully silent (source-URL fallback with no visible cause).
    console.log(
      `[tlon] upload: failed, using original URL: ${err instanceof Error ? err.stack ?? err.message : String(err)}`
    );
    return imageUrl;
  }
}
