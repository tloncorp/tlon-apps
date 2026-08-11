export type BucketsFlag = {
  host: string;
  name: string;
};

export type BucketsBucket = {
  id: number;
  title: string;
  createdBy: string;
  createdAt: number;
  updatedBy: string;
  updatedAt: number;
};

export type BucketsFile = {
  mime: string;
  size: number;
  checksum: string | null;
  objectKey: string;
  objectUrl: string | null;
  status: 'pending' | 'ready' | 'failed';
};

type BucketsEntryBase = {
  id: number;
  parentId: number | null;
  name: string;
  createdBy: string;
  createdAt: number;
  updatedBy: string;
  updatedAt: number;
};

export type BucketsFolderEntry = BucketsEntryBase & {
  kind: 'folder';
};

export type BucketsFileEntry = BucketsEntryBase & {
  kind: 'file';
  file: BucketsFile;
};

export type BucketsEntry = BucketsFolderEntry | BucketsFileEntry;

export type BucketsUploadSession = {
  id: string;
  fileId: number;
  requestedBy: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'complete' | 'failed';
  error: string | null;
};

export type BucketsState = {
  bucket: BucketsBucket;
  group: BucketsFlag;
  readers: string[];
  writers: string[];
  entries: BucketsEntry[];
  sessions: BucketsUploadSession[];
  revision: number;
};

export type BucketsSnapshot = {
  flag: BucketsFlag;
  state: BucketsState;
};

export type BucketsUpdate =
  | { type: 'bucket-created'; bucket: BucketsBucket }
  | { type: 'bucket-deleted' }
  | { type: 'bucket-updated'; bucket: BucketsBucket }
  | { type: 'readers-updated'; readers: string[] }
  | { type: 'writers-updated'; writers: string[] }
  | { type: 'folder-created'; entry: BucketsFolderEntry }
  | {
      type: 'upload-begun';
      session: BucketsUploadSession;
      entry: BucketsFileEntry;
    }
  | {
      type: 'upload-ready';
      session: BucketsUploadSession;
      entry: BucketsFileEntry;
    }
  | {
      type: 'upload-failed';
      session: BucketsUploadSession;
      entry: BucketsFileEntry;
    }
  | { type: 'entry-updated'; entry: BucketsEntry }
  | { type: 'entries-deleted'; ids: number[] };

export type BucketsResponse =
  | { type: 'snapshot'; flag: BucketsFlag; state: BucketsState }
  | {
      type: 'update';
      flag: BucketsFlag;
      revision: number;
      actor: string;
      update: BucketsUpdate;
    };

export type BucketsAction =
  | {
      type: 'create';
      name: string;
      title: string;
      group: BucketsFlag;
      readers: string[];
      writers: string[];
    }
  | { type: 'delete-bucket'; flag: BucketsFlag }
  | { type: 'set-title'; flag: BucketsFlag; title: string }
  | { type: 'set-readers'; flag: BucketsFlag; readers: string[] }
  | { type: 'set-writers'; flag: BucketsFlag; writers: string[] }
  | {
      type: 'create-folder';
      flag: BucketsFlag;
      parentId: number | null;
      name: string;
    }
  | {
      type: 'begin-upload';
      flag: BucketsFlag;
      parentId: number | null;
      name: string;
      mime: string;
      size: number;
      checksum: string | null;
      capability: string;
    }
  | {
      type: 'finish-upload';
      flag: BucketsFlag;
      sessionId: string;
      objectUrl: string;
    }
  | {
      type: 'fail-upload';
      flag: BucketsFlag;
      sessionId: string;
      reason: string;
    }
  | {
      type: 'issue-read';
      flag: BucketsFlag;
      id: number;
      capability: string;
    }
  | {
      type: 'issue-delete';
      flag: BucketsFlag;
      id: number;
      capability: string;
    }
  | { type: 'rename-entry'; flag: BucketsFlag; id: number; name: string }
  | {
      type: 'move-entry';
      flag: BucketsFlag;
      id: number;
      parentId: number | null;
    }
  | {
      type: 'delete-entry';
      flag: BucketsFlag;
      id: number;
      recursive: boolean;
    };
