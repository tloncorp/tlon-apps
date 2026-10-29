import { useRef, useState } from 'react';
import { Linking } from 'react-native';

import {
  type BucketItem,
  canPreviewFromText,
  getBucketPreviewKind,
  readPreviewText,
} from '../../ui';

type ReadGrant = (entryId: number) => Promise<{ readUrl: string }>;

/**
 * One file's preview: a read grant for it, and its text for the kinds shown
 * as text.
 *
 * Shared by the pane, which previews in place on the desktop split, and by the
 * file screen the narrow layout pushes instead.
 */
export function useBucketPreview(readGrant: ReadGrant) {
  const [item, setItem] = useState<BucketItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = async (target: BucketItem) => {
    const currentRequestId = ++requestId.current;
    setItem(target);
    setLoading(true);
    setError(null);

    try {
      const { readUrl: previewUri } = await readGrant(Number(target.id));
      if (requestId.current !== currentRequestId) return;

      const readableItem = { ...target, previewUri };
      setItem(readableItem);

      // Checked against the manifest size before fetching, not after: the
      // read itself is what would exhaust memory.
      if (
        canPreviewFromText(readableItem) &&
        readableItem.textContent === undefined
      ) {
        const response = await fetch(previewUri);
        if (!response.ok) {
          throw new Error(`File request failed (${response.status})`);
        }
        // The manifest size is the writer's word; the body is bounded as
        // it is read. Over the cap the item keeps no text and the viewer
        // falls back to its unsupported notice, as for an oversize manifest.
        const textContent = await readPreviewText(response, {
          html: getBucketPreviewKind(readableItem) === 'html',
        });
        if (requestId.current !== currentRequestId) return;
        if (textContent !== null) {
          setItem({ ...readableItem, textContent });
        }
      }

      if (requestId.current === currentRequestId) {
        setLoading(false);
      }
    } catch (cause) {
      if (requestId.current !== currentRequestId) return;
      setLoading(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const close = () => {
    requestId.current += 1;
    setItem(null);
    setLoading(false);
    setError(null);
  };

  // Freshly signed rather than the URL captured when the preview loaded: a
  // grant lasts minutes, a preview left open lasts as long as the user leaves
  // it, and handing an expired URL to another app looks like lost access.
  const openExternally =
    item && item.previewUri
      ? () => {
          void readGrant(Number(item.id))
            .then((grant) => Linking.openURL(grant.readUrl))
            .catch((cause) =>
              setError(cause instanceof Error ? cause.message : String(cause))
            );
        }
      : undefined;

  return { close, error, item, load, loading, openExternally };
}
