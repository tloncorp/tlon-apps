import { createDevLogger } from '@tloncorp/shared';
import {
  createStorageItem,
  registerStorageItemListener,
} from '@tloncorp/shared/db';
import { useSyncExternalStore } from 'react';
import { browserCardKey } from './browserCardKey';
import type { BrowserPreview } from './browserPreview';

const logger = createDevLogger('BrowserPreviewCache', false);
export type BrowserPreviewEntry = {
  preview: BrowserPreview;
  snapshot?: Extract<BrowserPreview, { status: 'ready' }>;
  checkedAt: number;
};
type PreviewCache = Record<string, BrowserPreviewEntry>;
const terminalCache = createStorageItem<PreviewCache | null>({
  key: 'browserPreviewTerminalStates',
  defaultValue: null,
});
let previews: PreviewCache = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => previews;
// Storage reset runs on logout; discard in-memory page images at the same time.
registerStorageItemListener(terminalCache.config.key, async (value) => {
  if (value === null) {
    previews = {};
    notify();
  }
});
function usePreviewCache() {
  const memory = useSyncExternalStore(subscribe, snapshot, snapshot);
  const persisted = terminalCache.useStorageItem();
  return { ...persisted, value: { ...memory, ...persisted.value } };
}
export const browserPreviewCache = {
  useStorageItem: usePreviewCache,
  useValue: () => usePreviewCache().value,
};
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
  const key = browserCardKey(url);
  const entry = mergeBrowserPreview(previews[key], preview);
  // Images survive card remounts, but never enter persistent app storage.
  let imageBytes = 0;
  previews = Object.fromEntries(
    Object.entries({ ...previews, [key]: entry })
      .sort((a, b) => b[1].checkedAt - a[1].checkedAt)
      .slice(0, 1000)
      .map(([id, value]) => {
        imageBytes += value.snapshot?.image.length ?? 0;
        return imageBytes > 12 * 1024 * 1024 && value.snapshot
          ? [id, { preview: { status: 'busy' }, checkedAt: value.checkedAt }]
          : [id, value];
      })
  );
  notify();
  if (!isBrowserEnded(entry.preview.status)) return;
  try {
    await terminalCache.setValue((current) =>
      Object.fromEntries(
        Object.entries({ ...current, [key]: entry })
          .sort((a, b) => b[1].checkedAt - a[1].checkedAt)
          .slice(0, 1000)
      )
    );
  } catch {
    logger.trackError('Browser preview status could not be saved');
  }
}
