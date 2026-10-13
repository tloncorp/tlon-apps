import type { BucketUploadCandidate } from '../../ui';

export type BucketUploadTask = {
  cancel: () => Promise<void>;
  upload: Promise<void>;
};

export type CreateBucketUploadTask = (
  uploadUrl: string,
  candidate: BucketUploadCandidate,
  headers: Record<string, string>,
  onProgress: (progress: number) => void
) => BucketUploadTask;
