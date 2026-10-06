import type { BucketsFlag } from '@tloncorp/api';
import { useEffect, useRef } from 'react';

import { BucketFileViewer } from '../../ui';
import { toItem, toViewerItem } from './BucketsLiveChannel';
import { useBucketPreview } from './useBucketPreview';
import { useLiveBucket } from './useLiveBucket';

const noChildCounts: ReadonlyMap<number, number> = new Map();

/** One file of a Bucket, on the screen the narrow layout pushes for it. */
export function BucketsLiveFile({
  entryId,
  flag,
  onClose,
}: {
  entryId: number;
  flag: BucketsFlag;
  onClose: () => void;
}) {
  const live = useLiveBucket(flag);
  const preview = useBucketPreview(live.readGrant);
  const entry = live.entries.find((candidate) => candidate.id === entryId);
  const file = entry?.kind === 'file' ? toItem(entry, noChildCounts) : null;

  // Loaded once, when the entry first appears: the grant is read off the
  // manifest, so asking before it arrives fails. A later rename or delete
  // leaves the open preview as it was, as the in-place preview does.
  const requested = useRef(false);
  const { load } = preview;
  useEffect(() => {
    if (requested.current || entry?.kind !== 'file') return;
    requested.current = true;
    void load(toItem(entry, noChildCounts));
  }, [entry, load]);

  const missing = !live.loading && !file && !preview.item;
  const shown = preview.item ?? file;

  return (
    <BucketFileViewer
      error={missing ? 'This file is no longer in the Bucket' : preview.error}
      item={shown ? toViewerItem(shown) : { name: '' }}
      loading={!missing && (preview.loading || !preview.item)}
      onClose={onClose}
      onOpenExternally={preview.openExternally}
      onRetry={file ? () => void load(file) : undefined}
    />
  );
}
