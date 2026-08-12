import type {
  BucketsAction,
  BucketsEntry,
  BucketsFileEntry,
  BucketsSnapshot,
  BucketsUploadSession,
} from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createBucketsDeps } from './buckets-runtime';
import { mockedGetBuckets, mockedSendBucketsAction } from './tloncorp-api-mock';

const TARGET = {
  flag: { host: '~zod', name: 'project-files' },
  nest: 'buckets/~zod/project-files',
};
const GROUP = { host: '~zod', name: 'team' };
const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_BROKER_URL = process.env.BUCKETS_BROKER_URL;
const MAX_TEXT_READ_BYTES = 2 * 1024 * 1024;

function snapshot({
  entries = [],
  sessions = [],
  revision = 1,
  title = 'Project Files',
}: {
  entries?: BucketsEntry[];
  sessions?: BucketsUploadSession[];
  revision?: number;
  title?: string;
} = {}): BucketsSnapshot {
  return {
    flag: TARGET.flag,
    state: {
      bucket: {
        id: 1,
        title,
        createdBy: '~zod',
        createdAt: 1,
        updatedBy: '~zod',
        updatedAt: 1,
      },
      group: GROUP,
      readers: [],
      writers: [],
      entries,
      sessions,
      revision,
    },
  };
}

function pendingFile(id: number, objectKey: string): BucketsFileEntry {
  return {
    id,
    kind: 'file',
    parentId: null,
    name: 'plan.md',
    createdBy: '~zod',
    createdAt: 1,
    updatedBy: '~zod',
    updatedAt: 1,
    file: {
      mime: 'text/markdown',
      size: 12,
      checksum: null,
      objectKey,
      objectUrl: null,
      status: 'pending',
    },
  };
}

function session(id: string, fileId: number): BucketsUploadSession {
  return {
    id,
    fileId,
    requestedBy: '~zod',
    createdAt: 1,
    expiresAt: 2,
    status: 'pending',
    error: null,
  };
}

beforeEach(() => {
  process.env.BUCKETS_BROKER_URL = 'https://broker.test/v2/buckets';
  mockedGetBuckets.impl = async () => [];
  mockedSendBucketsAction.impl = async () => undefined;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_BROKER_URL === undefined) {
    delete process.env.BUCKETS_BROKER_URL;
  } else {
    process.env.BUCKETS_BROKER_URL = ORIGINAL_BROKER_URL;
  }
});

describe('Buckets runtime hardening', () => {
  it('rejects duplicate Bucket creation before sending an action', async () => {
    const actions: BucketsAction[] = [];
    mockedGetBuckets.impl = async () => [snapshot()];
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };

    await expect(
      createBucketsDeps().buckets.create({
        group: GROUP,
        title: 'Project Files',
        name: 'project-files',
      })
    ).rejects.toThrow('Bucket buckets/~zod/project-files already exists');
    expect(actions).toEqual([]);
  });

  it('correlates a same-name upload by broker object id and streams the file', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    const contents = '# Project\n';
    writeFileSync(filePath, contents);

    let phase: 'initial' | 'pending' | 'ready' = 'initial';
    const actions: BucketsAction[] = [];
    const other = pendingFile(10, 'object-other');
    const ours = pendingFile(11, 'object-mine');
    const pending = snapshot({
      entries: [other, ours],
      sessions: [session('session-other', 10), session('session-mine', 11)],
      revision: 2,
    });
    const ready = snapshot({
      entries: [
        other,
        {
          ...ours,
          file: { ...ours.file, status: 'ready' },
        },
      ],
      sessions: [
        session('session-other', 10),
        { ...session('session-mine', 11), status: 'complete' },
      ],
      revision: 3,
    });

    mockedGetBuckets.impl = async () => [
      phase === 'initial' ? snapshot() : phase === 'pending' ? pending : ready,
    ];
    mockedSendBucketsAction.impl = async (action: unknown) => {
      const typed = action as BucketsAction;
      actions.push(typed);
    };
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.endsWith('/uploads/grant')) {
        // Broker authorization is the authoritative acknowledgement from the
        // host. Only expose the replicated session after that acknowledgement
        // so this test fails if the CLI regresses to scry-first polling.
        phase = 'pending';
        return Response.json({
          reservationId: 'reservation-mine',
          objectId: 'object-mine',
          uploadUrl: 'https://upload.test/object-mine',
          requiredHeaders: [['Content-Type', 'text/markdown']],
        });
      }
      if (url === 'https://upload.test/object-mine') {
        expect(init?.body).toBeInstanceOf(Blob);
        expect(await (init?.body as Blob).text()).toBe(contents);
        phase = 'ready';
        return new Response('', { status: 200 });
      }
      if (url.endsWith('/uploads/reservation-mine/complete')) {
        return Response.json({});
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      await expect(
        createBucketsDeps().buckets.upload({
          target: TARGET,
          filePath,
          parentId: null,
        })
      ).resolves.toMatchObject({ id: 11, status: 'ready' });
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        type: 'begin-upload',
        name: 'plan.md',
        size: Buffer.byteLength(contents),
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports broker rejection as an authorization failure, not a replica timeout', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    mockedGetBuckets.impl = async () => [snapshot()];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.endsWith('/uploads/grant')) {
        return Response.json(
          {
            code: 'permission_denied',
            message: 'The Bucket host rejected this actor',
            retryable: false,
          },
          { status: 403 }
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      await expect(
        createBucketsDeps().buckets.upload({
          target: TARGET,
          filePath,
          parentId: null,
        })
      ).rejects.toThrow(
        'Bucket host did not authorize plan.md: The Bucket host rejected this actor'
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('cancels a text download as soon as it exceeds the 2 MiB limit', async () => {
    const entry: BucketsEntry = {
      ...pendingFile(12, 'object-read'),
      file: {
        ...pendingFile(12, 'object-read').file,
        size: 1,
        status: 'ready',
      },
    };
    mockedGetBuckets.impl = async () => [snapshot({ entries: [entry] })];

    let canceled = false;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.endsWith('/objects/object-read/read-grant')) {
        return Response.json({
          objectId: 'object-read',
          readUrl: 'https://read.test/object-read',
        });
      }
      if (url === 'https://read.test/object-read') {
        let sent = false;
        return new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (sent) return;
              sent = true;
              controller.enqueue(new Uint8Array(MAX_TEXT_READ_BYTES + 1));
            },
            cancel() {
              canceled = true;
            },
          })
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    await expect(createBucketsDeps().buckets.read(TARGET, 12)).rejects.toThrow(
      'exceeded the 2097152-byte text read limit'
    );
    expect(canceled).toBe(true);
  });
});
