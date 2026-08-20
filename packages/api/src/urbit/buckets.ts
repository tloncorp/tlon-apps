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

export type BucketsState = {
  bucket: BucketsBucket;
  group: BucketsFlag;
  readers: string[];
  writers: string[];
  entries: BucketsEntry[];
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
  | { type: 'entry-created'; id: number; entry: BucketsEntry }
  | { type: 'entry-updated'; id: number; entry: BucketsEntry }
  | { type: 'entries-deleted'; ids: number[] };

export type BucketsResponse =
  | { type: 'snapshot'; flag: BucketsFlag; state: BucketsState }
  | {
      type: 'update';
      flag: BucketsFlag;
      revision: number;
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
    }
  | {
      type: 'fail-upload';
      flag: BucketsFlag;
      sessionId: string;
      reason: string;
    }
  | { type: 'issue-bucket-read'; flag: BucketsFlag }
  | {
      type: 'issue-delete';
      flag: BucketsFlag;
      id: number;
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

/**
 * A host-minted bearer token, returned only to the ship that asked for it.
 *
 * For an upload the token is the session id; for a read or delete it is a
 * freshly minted capability. Either way it is what gets presented to the
 * storage broker — the client never invents one.
 */
export type BucketsGrant = {
  token: string;
  entryId: number;
  expiresAt: string;
};

export type BucketsActionError =
  | 'not-authorized'
  | 'not-found'
  | 'invalid-input'
  | 'unknown';

/**
 * The terminal answer to one submitted action.
 *
 * `pending` is emitted by our own ship once it has forwarded the action to the
 * bucket's host and is waiting; the host's real answer replaces it.
 */
/**
 * A bucket-wide read capability.
 *
 * Read access is uniform across a bucket, so one token covers every ready
 * object in it. Each ship holds its own, refreshed by its own timer, and
 * serves it to local clients over a scry — so a read costs no round trip to
 * the bucket's host.
 */
export type BucketsReadToken = {
  token: string;
  expiresAt: string;
};

export type BucketsResponseBody =
  | { ok: null }
  | { grant: BucketsGrant }
  | { token: BucketsReadToken }
  | { pending: null }
  | { error: { type: BucketsActionError; message: string } };

export type BucketsRequestResponse = {
  requestId: string;
  body: BucketsResponseBody;
};
