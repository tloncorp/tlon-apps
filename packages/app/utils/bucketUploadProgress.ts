export type BucketUploadBatchItem = {
  id: string;
  progress: number;
  size: number;
  state: 'active' | 'completed' | 'failed';
};

function normalizedProgress(progress: number) {
  return Math.max(0, Math.min(100, progress));
}

export function calculateBucketUploadProgress(
  items: readonly Pick<BucketUploadBatchItem, 'progress' | 'size'>[]
) {
  if (items.length === 0) return 0;

  const measurableItems = items.filter((item) => item.size > 0);
  const totalBytes = measurableItems.reduce((sum, item) => sum + item.size, 0);
  if (totalBytes > 0) {
    const weightedProgress = measurableItems.reduce(
      (sum, item) => sum + item.size * normalizedProgress(item.progress),
      0
    );
    return Math.round(weightedProgress / totalBytes);
  }

  return Math.round(
    items.reduce((sum, item) => sum + normalizedProgress(item.progress), 0) /
      items.length
  );
}

export function completeBucketUploadInBatch(
  items: readonly BucketUploadBatchItem[],
  id: string
) {
  const next = items.map((item) =>
    item.id === id
      ? { ...item, progress: 100, state: 'completed' as const }
      : item
  );
  return next.every((item) => item.state === 'completed') ? [] : next;
}

export function removeBucketUploadFromBatch(
  items: readonly BucketUploadBatchItem[],
  id: string
) {
  const next = items.filter((item) => item.id !== id);
  return next.every((item) => item.state === 'completed') ? [] : next;
}
