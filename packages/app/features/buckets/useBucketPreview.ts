import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import {
  type BucketItem,
  canPreviewFromText,
  getBucketPreviewKind,
  readPreviewText,
} from '../../ui';

type ReadGrant = (
  entryId: number
) => Promise<{ readUrl: string; expiresAt: string }>;
type CachedPreview = { item: BucketItem; expiresAt: number };
const MAX_CACHED_PREVIEWS = 20;
// Leave time for a remounted viewer to buffer and issue follow-up range requests.
const READ_GRANT_EXPIRY_MARGIN_MS = 30_000;

/** Session-local previews shared by the desktop pane and the file screen. */
export function useBucketPreview(readGrant: ReadGrant, bucketKey: string) {
  const [item, setItem] = useState<BucketItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const externalOpenScope = useRef<{ bucketKey: string } | null>(null);
  useEffect(() => {
    externalOpenScope.current = { bucketKey };
    return () => {
      externalOpenScope.current = null;
    };
  }, [bucketKey]);
  const cache = useRef(new Map<string, CachedPreview>());
  const pending = useRef(new Map<string, Promise<CachedPreview>>());

  const keyFor = (target: BucketItem) =>
    JSON.stringify([
      bucketKey,
      target.id,
      target.previewCacheKey,
      target.name,
      target.mimeType,
      target.size,
    ]);

  const getCached = (target: BucketItem): BucketItem | undefined => {
    const cached = cache.current.get(keyFor(target));
    if (!cached || cached.expiresAt <= Date.now() + READ_GRANT_EXPIRY_MARGIN_MS)
      return;
    return {
      ...target,
      previewUri: cached.item.previewUri,
      textContent: cached.item.textContent,
      previewCached: true,
      previewImageLoaded: cached.item.previewImageLoaded,
    };
  };

  const invalidate = (target: BucketItem) => {
    const key = keyFor(target);
    const cached = cache.current.get(key);
    if (cached && cached.item.previewUri === target.previewUri)
      cache.current.delete(key);
  };
  const markImageLoaded = (target: BucketItem) => {
    const cached = cache.current.get(keyFor(target));
    if (cached && cached.item.previewUri === target.previewUri)
      cached.item.previewImageLoaded = true;
  };

  const load = async (target: BucketItem, { refresh = false } = {}) => {
    const currentRequestId = ++requestId.current;
    const key = keyFor(target);
    const cached = refresh ? undefined : getCached(target);
    setError(null);
    if (cached) {
      // Touch on selection, not render, so eviction follows browsing order.
      const entry = cache.current.get(key)!;
      cache.current.delete(key);
      cache.current.set(key, entry);
      setItem(cached);
      setLoading(false);
      return;
    }

    cache.current.delete(key);
    setItem({ ...target, previewUri: undefined, previewCached: false });
    setLoading(true);
    try {
      let request = refresh ? undefined : pending.current.get(key);
      if (!request) {
        request = (async (): Promise<CachedPreview> => {
          const { readUrl: previewUri, expiresAt } = await readGrant(
            Number(target.id)
          );
          const readableItem = {
            ...target,
            previewUri,
            previewCached: false,
            previewImageLoaded: false,
            textContent: refresh ? undefined : target.textContent,
          };
          // Check the manifest size before reading the entire object into memory.
          if (
            canPreviewFromText(readableItem) &&
            readableItem.textContent === undefined
          ) {
            const response = await fetch(previewUri);
            if (!response.ok) {
              throw new Error(`File request failed (${response.status})`);
            }
            // Bound the response as it is read, even if the manifest understates it.
            const textContent = await readPreviewText(response, {
              html: getBucketPreviewKind(readableItem) === 'html',
            });
            if (textContent !== null) readableItem.textContent = textContent;
          }
          return {
            item: readableItem,
            // The broker may send more fractional digits than Date.parse accepts.
            expiresAt: Date.parse(expiresAt.replace(/(\.\d{3})\d+/, '$1')) || 0,
          };
        })();
        pending.current.set(key, request);
        const started = request;
        void request.catch(() => {
          if (pending.current.get(key) === started) pending.current.delete(key);
        });
      }
      const result = await request;
      // Keep late results for a return swipe, but never replace a newer request
      // or repopulate the cache after the preview has been closed.
      if (pending.current.get(key) === request) {
        pending.current.delete(key);
        cache.current.set(key, result);
        while (cache.current.size > MAX_CACHED_PREVIEWS) {
          cache.current.delete(cache.current.keys().next().value!);
        }
      }
      if (requestId.current !== currentRequestId) return;
      setItem({
        ...target,
        previewUri: result.item.previewUri,
        textContent: result.item.textContent,
        previewCached: false,
        previewImageLoaded: result.item.previewImageLoaded,
      });
      setLoading(false);
    } catch (cause) {
      // A failed request is retryable, including after navigating away and back.
      if (requestId.current === currentRequestId) {
        setLoading(false);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
  };

  const close = () => {
    requestId.current += 1;
    cache.current.clear();
    pending.current.clear();
    setItem(null);
    setLoading(false);
    setError(null);
  };

  // External apps always receive a freshly signed link, even for a cached preview.
  const openExternally =
    item && item.previewUri
      ? () => {
          const openedRequestId = requestId.current;
          const openedScope = externalOpenScope.current;
          const isCurrent = () =>
            openedScope !== null &&
            requestId.current === openedRequestId &&
            externalOpenScope.current === openedScope;
          void readGrant(Number(item.id))
            .then((grant) => {
              if (isCurrent()) return Linking.openURL(grant.readUrl);
            })
            .catch((cause) => {
              if (isCurrent())
                setError(
                  cause instanceof Error ? cause.message : String(cause)
                );
            });
        }
      : undefined;

  return {
    close,
    error,
    getCached,
    invalidate,
    item,
    load,
    loading,
    markImageLoaded,
    openExternally,
  };
}
