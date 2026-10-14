import type { BucketsFlag } from '@tloncorp/api';
import { useEffect, useRef, useState } from 'react';

import { BucketFileViewer } from '../../ui';
import { toItem, toViewerItem } from './BucketsLiveChannel';
import { useBucketPreview } from './useBucketPreview';
import { useLiveBucket } from './useLiveBucket';
import { getBucketPreviewFiles } from './bucketPreviewFiles';

type Props = {
  entryId: number;
  flag: BucketsFlag;
  onClose: () => void;
  onSelectEntry?: (entryId: number) => void;
};

export function BucketsLiveFile(props: Props) {
  return (
    <BucketsFileSelection
      key={`${props.flag.host}/${props.flag.name}`}
      {...props}
    />
  );
}

function BucketsFileSelection({
  entryId,
  flag,
  onClose,
  onSelectEntry,
}: Props) {
  const live = useLiveBucket(flag);
  const preview = useBucketPreview(live.readGrant, `${flag.host}/${flag.name}`);
  const [selection, setSelection] = useState({ entryId, selectedId: entryId });
  // Route updates can confirm a swipe or select a new deep-linked file. Keep
  // the preview session mounted so neither case discards already-loaded files.
  if (selection.entryId !== entryId)
    setSelection({ entryId, selectedId: entryId });
  const { selectedId } = selection;
  const entry = live.entries.find((candidate) => candidate.id === selectedId);
  const files = getBucketPreviewFiles(live.entries, selectedId).map((entry) =>
    toItem(entry)
  );
  const file = entry?.kind === 'file' ? toItem(entry) : null;

  // Load each selected file once its entry appears: the grant is read off the
  // manifest, so asking before it arrives fails. A later rename or delete
  // leaves the open preview as it was, as the in-place preview does.
  const requested = useRef<number | null>(null);
  const { load } = preview;
  useEffect(() => {
    if (requested.current === selectedId || entry?.kind !== 'file') return;
    requested.current = selectedId;
    void load(toItem(entry));
  }, [entry, load, selectedId]);

  // Only once the manifest is known: a link opened cold reads an empty
  // Bucket before the first snapshot arrives.
  const selectedPreview =
    preview.item?.id === String(selectedId) ? preview.item : null;
  const missing =
    !live.loading && live.manifestKnown && !file && !selectedPreview;
  const shown = selectedPreview ?? file;

  return (
    <BucketFileViewer
      error={missing ? 'This file is no longer in the Bucket' : preview.error}
      item={shown ? toViewerItem(shown) : { name: '' }}
      loading={
        !missing && (preview.loading || preview.item?.id !== String(selectedId))
      }
      navigation={{
        items: files.map((file) =>
          toViewerItem(preview.getCached(file) ?? file)
        ),
        index: files.findIndex((file) => file.id === String(selectedId)),
        onSelect: (index) => {
          const file = files[index];
          if (file) {
            requested.current = Number(file.id);
            setSelection({ entryId, selectedId: Number(file.id) });
            void load(file);
            onSelectEntry?.(Number(file.id));
          }
        },
      }}
      onClose={onClose}
      onImageLoad={shown ? () => preview.markImageLoaded(shown) : undefined}
      onPreviewError={shown ? () => preview.invalidate(shown) : undefined}
      onOpenExternally={preview.openExternally}
      onRetry={file ? () => void load(file, { refresh: true }) : undefined}
    />
  );
}
