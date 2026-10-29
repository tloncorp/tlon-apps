import { createDevLogger } from '@tloncorp/shared';
import { createStorageItem } from '@tloncorp/shared/db';
import type { BrowserPreview } from './browserPreview';

const logger = createDevLogger('BrowserPreviewCache', false);
export type BrowserPreviewEntry = {
  preview: BrowserPreview;
  snapshot?: Extract<BrowserPreview, { status: 'ready' }>;
  checkedAt: number;
};
export const browserPreviewCache = createStorageItem<Record<
  string,
  BrowserPreviewEntry
> | null>({
  key: 'browserPreviewCache',
  defaultValue: null,
  isLarge: true,
});
export function browserPreviewKey(url: string) {
  const parsed = new URL(url);
  return parsed.origin + parsed.pathname;
}
export function isBrowserEnded(status?: BrowserPreview['status']) {
  return status === 'ended' || status === 'expired';
}
export function mergeBrowserPreview(
  previous: BrowserPreviewEntry | undefined,
  preview: BrowserPreview
): BrowserPreviewEntry {
  if (isBrowserEnded(previous?.preview.status)) return previous!;
  return {
    preview,
    snapshot:
      preview.status === 'ready'
        ? preview
        : isBrowserEnded(preview.status) || preview.status === 'protected'
          ? undefined
          : previous?.snapshot,
    checkedAt: Date.now(),
  };
}
export async function rememberBrowserPreview(
  url: string,
  preview: BrowserPreview
) {
  try {
    await browserPreviewCache.setValue((current) => {
      const key = browserPreviewKey(url);
      const next = {
        ...current,
        [key]: mergeBrowserPreview(current?.[key], preview),
      };
      // Keep images within a bounded local cache; terminal receipts are much smaller.
      let imageBytes = 0;
      return Object.fromEntries(
        Object.entries(next)
          .sort((a, b) => b[1].checkedAt - a[1].checkedAt)
          .slice(0, 1000)
          .map(([id, entry]) => {
            imageBytes += entry.snapshot?.image.length ?? 0;
            if (imageBytes > 12 * 1024 * 1024 && entry.snapshot) {
              return [
                id,
                { ...entry, preview: { status: 'busy' }, snapshot: undefined },
              ];
            }
            return [id, entry];
          })
      );
    });
  } catch {
    logger.trackError('Browser preview cache could not be saved');
  }
}
