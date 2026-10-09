import type { BucketsFlag } from '@tloncorp/api';
import { useEffect, useRef, useState } from 'react';

import { BucketFileViewer } from '../../ui';
import { toItem, toViewerItem } from './BucketsLiveChannel';
import { useBucketPreview } from './useBucketPreview';
import { useLiveBucket } from './useLiveBucket';
import { getBucketPreviewFiles } from './bucketPreviewFiles';

const noChildCounts: ReadonlyMap<number, number> = new Map();

type Props = {
  entryId: number;
  flag: BucketsFlag;
  onClose: () => void;
};

export function BucketsLiveFile(props: Props) {
  return (
    <BucketsFileSelection
      key={`${props.flag.host}/${props.flag.name}/${props.entryId}`}
      {...props}
    />
  );
}

function BucketsFileSelection({ entryId, flag, onClose }: Props) {
  const live = useLiveBucket(flag);
  const preview = useBucketPreview(live.readGrant);
  const [selectedId, setSelectedId] = useState(entryId);
  const entry = live.entries.find((candidate) => candidate.id === selectedId);
  const files = getBucketPreviewFiles(live.entries, selectedId).map((entry) =>
    toItem(entry, noChildCounts)
  );
  const file = entry?.kind === 'file' ? toItem(entry, noChildCounts) : null;

  // Load each selected file once its entry appears: the grant is read off the
  // manifest, so asking before it arrives fails. A later rename or delete
  // leaves the open preview as it was, as the in-place preview does.
  const requested = useRef<number | null>(null);
  const { load } = preview;
  useEffect(() => {
    if (requested.current === selectedId || entry?.kind !== 'file') return;
    requested.current = selectedId;
    void load(toItem(entry, noChildCounts));
  }, [entry, load, selectedId]);

  // Only once the manifest is known: a link opened cold reads an empty
  // Bucket before the first snapshot arrives.
  const missing = !live.loading && live.manifestKnown && !file && !preview.item;
  const shown = preview.item?.id === String(selectedId) ? preview.item : file;

  return (
    <BucketFileViewer
      error={missing ? 'This file is no longer in the Bucket' : preview.error}
      item={shown ? toViewerItem(shown) : { name: '' }}
      loading={
        !missing && (preview.loading || preview.item?.id !== String(selectedId))
      }
      navigation={{
        items: files.map(toViewerItem),
        index: files.findIndex((file) => file.id === String(selectedId)),
        onSelect: (index) => {
          const file = files[index];
          if (file) setSelectedId(Number(file.id));
        },
      }}
      onClose={onClose}
      onOpenExternally={preview.openExternally}
      onRetry={file ? () => void load(file) : undefined}
    />
  );
}
