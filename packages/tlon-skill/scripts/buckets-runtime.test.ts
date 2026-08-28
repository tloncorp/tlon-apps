import type {
  BucketsAction,
  BucketsEntry,
  BucketsFileEntry,
  BucketsSnapshot,
} from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createBucketsDeps } from './buckets-runtime';
import {
  mockedGetBucket,
  mockedGetBuckets,
  mockedGetBucketReadToken,
  mockedRequestBucketsGrant,
  mockedSendBucketsAction,
} from './tloncorp-api-mock';

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
  revision = 1,
  title = 'Project Files',
}: {
  entries?: BucketsEntry[];
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
      writers: [],
      entries,
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
      status: 'pending',
    },
  };
}

beforeEach(() => {
  process.env.BUCKETS_BROKER_URL = 'https://broker.test/v2/buckets';
  mockedGetBuckets.impl = async () => [];
  mockedGetBucket.impl = async () => null;
  mockedGetBucketReadToken.impl = async () => null;
  mockedRequestBucketsGrant.impl = async () => undefined;
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

  it('uses the host-minted upload grant and streams the file', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    const contents = '# Project\n';
    writeFileSync(filePath, contents);

    let phase: 'initial' | 'pending' | 'ready' = 'initial';
    const other = pendingFile(10, 'object-other');
    const ours = pendingFile(11, 'object-mine');
    const pending = snapshot({ entries: [other, ours], revision: 2 });
    const ready = snapshot({
      entries: [
        other,
        {
          ...ours,
          file: { ...ours.file, status: 'ready' },
        },
      ],
      revision: 3,
    });

    mockedGetBucket.impl = async () =>
      phase === 'initial' ? snapshot() : phase === 'pending' ? pending : ready;
    mockedRequestBucketsGrant.impl = async (action: unknown) => {
      expect(action).toMatchObject({
        type: 'begin-upload',
        name: 'plan.md',
        size: Buffer.byteLength(contents),
      });
      phase = 'pending';
      return { token: 'upload-token', entryId: 11, expiresAt: '~2026.1.1' };
    };
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.endsWith('/uploads/grant')) {
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
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports broker rejection as an authorization failure, not a replica timeout', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    mockedGetBucket.impl = async () => snapshot();
    mockedRequestBucketsGrant.impl = async () => ({
      token: 'upload-token',
      entryId: 12,
      expiresAt: '~2026.1.1',
    });
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
        'Bucket upload failed after the host authorized plan.md: The Bucket host rejected this actor'
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('cancels the broker reservation when an upload fails after it is granted', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    const actions: BucketsAction[] = [];
    mockedGetBucket.impl = async () => snapshot();
    mockedRequestBucketsGrant.impl = async () => ({
      token: 'upload-token',
      entryId: 12,
      expiresAt: '~2026.1.1',
    });
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };
    let canceled = false;
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.endsWith('/uploads/grant')) {
        return Response.json({
          reservationId: 'reservation-mine',
          objectId: 'object-mine',
          uploadUrl: 'https://upload.test/object-mine',
          requiredHeaders: [],
        });
      }
      if (url === 'https://upload.test/object-mine') {
        return new Response('nope', { status: 500, statusText: 'Error' });
      }
      if (url.endsWith('/uploads/reservation-mine/cancel')) {
        canceled = true;
        return Response.json({
          reservationId: 'reservation-mine',
          canceledAt: '~2026.1.1',
        });
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
      ).rejects.toThrow('Bucket upload failed after the host authorized');
      expect(canceled).toBe(true);
      expect(actions).toContainEqual({
        type: 'cancel-upload',
        flag: TARGET.flag,
        sessionId: 'upload-token',
        reason: expect.any(String),
      });
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
    mockedGetBucket.impl = async () => snapshot({ entries: [entry] });
    mockedGetBucketReadToken.impl = async () => ({
      token: 'read-token',
      expiresAt: '~2026.1.1',
    });

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
