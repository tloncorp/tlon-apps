import type { BucketsSnapshot } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  bucketResponseHasRevisionGap,
  reconcileUploadsWithSnapshot,
} from './bucketUploadReconciliation';

const snapshot = {
  flag: { host: '~zod', name: 'project-files' },
  state: {
    bucket: {
      createdAt: 1,
      createdBy: '~zod',
      id: 1,
      title: 'Project Files',
      updatedAt: 1,
      updatedBy: '~zod',
    },
    entries: [
      {
        createdAt: 1,
        createdBy: '~zod',
        file: {
          checksum: null,
          mime: 'image/heic',
          objectKey: 'first',
          objectUrl: null,
          size: 42,
          status: 'pending',
        },
        id: 10,
        kind: 'file',
        name: 'IMG_0111.heic',
        parentId: null,
        updatedAt: 1,
        updatedBy: '~zod',
      },
    ],
    group: { host: '~zod', name: 'group' },
    readers: ['member'],
    revision: 2,
    sessions: [
      {
        createdAt: 1,
        error: null,
        expiresAt: 2,
        fileId: 10,
        id: 'new-session',
        requestedBy: '~zod',
        status: 'pending',
      },
    ],
    writers: ['admin'],
  },
} satisfies BucketsSnapshot;

describe('reconcileUploadsWithSnapshot', () => {
  it('associates the optimistic upload with the matching ship entry', () => {
    const upload = {
      candidate: {
        mimeType: 'image/heic',
        name: 'IMG_0111.heic',
        size: 42,
      },
      id: 'local-upload',
      parentId: null,
      priorSessionIds: ['old-session'],
    };

    expect(reconcileUploadsWithSnapshot([upload], snapshot, '~zod')).toEqual([
      {
        ...upload,
        serverEntryId: 10,
        sessionId: 'new-session',
      },
    ]);
  });

  it('does not associate an entry from a session that predates the upload', () => {
    const upload = {
      candidate: {
        mimeType: 'image/heic',
        name: 'IMG_0111.heic',
        size: 42,
      },
      id: 'local-upload',
      parentId: null,
      priorSessionIds: ['new-session'],
    };

    expect(reconcileUploadsWithSnapshot([upload], snapshot, '~zod')[0]).toBe(
      upload
    );
  });

  it('does not associate an upload session requested by another member', () => {
    const upload = {
      candidate: {
        mimeType: 'image/heic',
        name: 'IMG_0111.heic',
        size: 42,
      },
      id: 'local-upload',
      parentId: null,
      priorSessionIds: [] as string[],
    };

    expect(
      reconcileUploadsWithSnapshot([upload], snapshot, '~other-member')[0]
    ).toBe(upload);
  });

  it('matches identical concurrent uploads one-to-one', () => {
    const secondSnapshot: BucketsSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        entries: [
          ...snapshot.state.entries,
          {
            ...snapshot.state.entries[0],
            id: 11,
            file: { ...snapshot.state.entries[0].file, objectKey: 'second' },
          },
        ],
        sessions: [
          ...snapshot.state.sessions,
          {
            ...snapshot.state.sessions[0],
            fileId: 11,
            id: 'second-session',
          },
        ],
      },
    };
    const uploads = [
      {
        candidate: {
          mimeType: 'image/heic',
          name: 'IMG_0111.heic',
          size: 42,
        },
        id: 'first-local-upload',
        parentId: null,
        priorSessionIds: [] as string[],
      },
      {
        candidate: {
          mimeType: 'image/heic',
          name: 'IMG_0111.heic',
          size: 42,
        },
        id: 'second-local-upload',
        parentId: null,
        priorSessionIds: [] as string[],
      },
    ];

    const reconciled = reconcileUploadsWithSnapshot(
      uploads,
      secondSnapshot,
      '~zod'
    );
    expect(reconciled).toMatchObject([
      { serverEntryId: 10, sessionId: 'new-session' },
      { serverEntryId: 11, sessionId: 'second-session' },
    ]);
  });

  it('does not reuse an entry already claimed by another waiter', () => {
    const upload = {
      candidate: {
        mimeType: 'image/heic',
        name: 'IMG_0111.heic',
        size: 42,
      },
      id: 'second-local-upload',
      parentId: null,
      priorSessionIds: [] as string[],
    };

    expect(
      reconcileUploadsWithSnapshot([upload], snapshot, '~zod', new Set([10]))[0]
    ).toBe(upload);
  });
});

describe('bucketResponseHasRevisionGap', () => {
  it('requests a refresh when an update skips a revision', () => {
    expect(
      bucketResponseHasRevisionGap(snapshot, {
        type: 'update',
        actor: '~zod',
        flag: snapshot.flag,
        revision: snapshot.state.revision + 2,
        update: { type: 'bucket-updated', bucket: snapshot.state.bucket },
      })
    ).toBe(true);
  });

  it('accepts the next revision and replacement snapshots', () => {
    expect(
      bucketResponseHasRevisionGap(snapshot, {
        type: 'update',
        actor: '~zod',
        flag: snapshot.flag,
        revision: snapshot.state.revision + 1,
        update: { type: 'bucket-updated', bucket: snapshot.state.bucket },
      })
    ).toBe(false);
    expect(
      bucketResponseHasRevisionGap(snapshot, {
        type: 'snapshot',
        flag: snapshot.flag,
        state: snapshot.state,
      })
    ).toBe(false);
  });
});
