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

import {
  createBucketsDeps,
  setReplicaWaitForTests,
  setUploadDestinationPolicyForTests,
} from './buckets-runtime';
import { CommandError } from './commands/command';
import {
  mockedGetBucket,
  mockedGetBuckets,
  mockedGetBucketReadToken,
  mockedRequestBucketsGrant,
  mockedRequestBucketsUpload,
  mockedGetGroup,
  mockedSendBucketsAction,
  MockBucketsActionFailed,
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

// The test hostnames do not resolve. Answer them with a public address and
// keep the real address policy, so the destination check still runs.
const PUBLIC_ADDRESS = '93.184.216.34';

beforeEach(() => {
  setUploadDestinationPolicyForTests({
    resolveHost: async () => [PUBLIC_ADDRESS],
  });
  process.env.BUCKETS_BROKER_URL = 'https://broker.test/v2/buckets';
  mockedGetBuckets.impl = async () => [];
  mockedGetBucket.impl = async () => null;
  mockedGetBucketReadToken.impl = async () => null;
  mockedRequestBucketsGrant.impl = async () => undefined;
  mockedRequestBucketsUpload.impl = async () => undefined;
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

  // Both role lists mean the opposite of restrictive when empty: readers []
  // is readable by every group member, writers [] is writable by every
  // reader. So a restricted Bucket has to be created restricted, and a role
  // the group does not have is dropped by reconciliation -- leaving empty.
  it('sends reader and writer roles with the create itself', async () => {
    const actions: BucketsAction[] = [];
    mockedGetBuckets.impl = async () => [];
    mockedGetGroup.impl = async () => ({
      roles: [{ id: 'admin' }, { id: 'staff' }],
    });
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };

    // create polls until the Bucket shows up, so the snapshot has to answer.
    mockedGetBucket.impl = async () => snapshot({ title: 'Private' });

    await createBucketsDeps().buckets.create({
      group: GROUP,
      title: 'Private',
      name: 'private',
      readers: ['staff'],
      writers: ['admin'],
    });

    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'create',
        readers: ['staff'],
        writers: ['admin'],
      })
    );
  });

  it('refuses a role the group does not have rather than widening access', async () => {
    const actions: BucketsAction[] = [];
    mockedGetBuckets.impl = async () => [];
    mockedGetGroup.impl = async () => ({ roles: [{ id: 'admin' }] });
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };

    await expect(
      createBucketsDeps().buckets.create({
        group: GROUP,
        title: 'Private',
        name: 'private',
        writers: ['admn'],
      })
    ).rejects.toThrow('has no role named admn');
    expect(actions).toEqual([]);
  });

  it('refuses an unknown role on set-writers', async () => {
    const actions: BucketsAction[] = [];
    mockedGetBucket.impl = async () => snapshot();
    mockedGetGroup.impl = async () => ({ roles: [{ id: 'admin' }] });
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };

    await expect(
      createBucketsDeps().buckets.setWriters(TARGET, ['pubilsher'])
    ).rejects.toThrow('has no role named pubilsher');
    expect(actions).toEqual([]);
  });

  // The snapshot already proves these wrong. Sending anyway costs a poke that
  // succeeds locally, ten seconds of polling, and a generic timeout instead
  // of the reason.
  it('refuses a parent that is missing or is a file, before sending', async () => {
    const actions: BucketsAction[] = [];
    const file = { ...pendingFile(7, 'object-7'), kind: 'file' as const };
    mockedGetBucket.impl = async () => snapshot({ entries: [file] });
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };
    const deps = createBucketsDeps();

    await expect(deps.buckets.files(TARGET, 999)).rejects.toThrow(
      'Parent 999 does not exist'
    );
    await expect(
      deps.buckets.createFolder({ target: TARGET, parentId: 7, name: 'sub' })
    ).rejects.toThrow('Parent 7 is a file, not a folder');
    await expect(deps.buckets.move(TARGET, 7, 999)).rejects.toThrow(
      'Destination 999 does not exist'
    );
    expect(actions).toEqual([]);
  });

  it('refuses to delete a folder that still holds entries', async () => {
    const actions: BucketsAction[] = [];
    const folder = {
      id: 3,
      kind: 'folder' as const,
      name: 'docs',
      parentId: null,
      updatedAt: 1,
      updatedBy: '~zod',
    };
    const child = { ...pendingFile(4, 'object-4'), parentId: 3 };
    mockedGetBucket.impl = async () =>
      snapshot({ entries: [folder, child] as BucketsEntry[] });
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };

    await expect(createBucketsDeps().buckets.delete(TARGET, 3)).rejects.toThrow(
      'Folder 3 is not empty; it holds 1 entry'
    );
    expect(actions).toEqual([]);
  });

  // The action has already been sent when polling starts, so the host may
  // well have applied it. Abandoning the loop on one failed read reports a
  // failure the caller may retry -- duplicating the folder, since the host
  // permits same-named ones.
  it('keeps polling through a transient snapshot failure', async () => {
    let reads = 0;
    mockedGetBucket.impl = async () => {
      reads += 1;
      if (reads === 1) return snapshot();
      if (reads === 2) throw new Error('network blip');
      return snapshot({
        entries: [
          {
            id: 42,
            kind: 'folder',
            name: 'plans',
            parentId: null,
            updatedAt: 1,
            updatedBy: '~zod',
          },
        ] as unknown as BucketsEntry[],
        revision: 9,
      });
    };

    await expect(
      createBucketsDeps().buckets.createFolder({
        target: TARGET,
        parentId: null,
        name: 'plans',
      })
    ).resolves.toMatchObject({ id: 42 });
    expect(reads).toBeGreaterThan(2);
  });

  // The client throws on a refusal; it never returns an error body. This
  // used to mock `{ body: { error } }`, a shape the real client cannot
  // produce, and passed against a branch that could never run.
  it('refuses a folder the host rejected rather than adopting another one', async () => {
    mockedGetBucket.impl = async () => snapshot();
    mockedSendBucketsAction.impl = async () => {
      throw new MockBucketsActionFailed('not-authorized', 'not a writer');
    };

    const attempt = createBucketsDeps().buckets.createFolder({
      target: TARGET,
      parentId: null,
      name: 'plans',
    });
    await expect(attempt).rejects.toThrow(
      'The Bucket host refused this: not a writer'
    );
  });

  it('turns every host refusal into a command error, not just the folder one', async () => {
    mockedGetBucket.impl = async () =>
      snapshot({ entries: [pendingFile(12, 'object-mine')] });
    mockedSendBucketsAction.impl = async () => {
      throw new MockBucketsActionFailed('not-authorized', 'not a writer');
    };
    const attempt = createBucketsDeps().buckets.rename(TARGET, 12, 'final.md');
    await expect(attempt).rejects.toBeInstanceOf(CommandError);
    await expect(attempt).rejects.toThrow(
      'The Bucket host refused this: not a writer'
    );
  });

  // A Bucket hosted on another ship answers on one subscription and updates
  // the local replica on another, and ames does not order the two. The %ok
  // is the confirmation: a replica that has not caught up must not turn a
  // landed file into a reported failure, and must not be cancelled.
  it('reports a finished upload as done when the replica has not caught up', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    const contents = '# Project\n';
    writeFileSync(filePath, contents);
    setReplicaWaitForTests(2, 1);

    const ours = pendingFile(11, 'object-mine');
    // the replica only ever shows the entry as pending
    mockedGetBucket.impl = async () =>
      snapshot({ entries: [ours], revision: 2 });
    mockedRequestBucketsUpload.impl = async () => ({
      session: 'upload-session',
      entryId: 11,
      url: 'https://upload.test/object-mine',
      headers: [['Content-Type', 'text/markdown']],
      expiresAt: '~2026.1.1',
    });
    const sent: string[] = [];
    mockedSendBucketsAction.impl = async (action: unknown) => {
      sent.push((action as BucketsAction).type);
    };
    globalThis.fetch = (async () =>
      new Response('', { status: 200 })) as unknown as typeof fetch;

    try {
      const result = await createBucketsDeps().buckets.upload({
        target: TARGET,
        filePath,
        parentId: null,
      });
      expect(result).toMatchObject({
        id: 11,
        name: 'plan.md',
        size: Buffer.byteLength(contents),
        status: 'ready',
      });
      expect(result).toHaveProperty('note');
      expect(sent).toEqual(['finish-upload']);
    } finally {
      setReplicaWaitForTests(40, 250);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports a created folder as created when the replica has not caught up', async () => {
    setReplicaWaitForTests(2, 1);
    mockedGetBucket.impl = async () => snapshot();
    mockedSendBucketsAction.impl = async () => ({ ok: null });

    try {
      const result = await createBucketsDeps().buckets.createFolder({
        target: TARGET,
        parentId: null,
        name: 'plans',
      });
      expect(result).toMatchObject({ created: 'plans', id: null });
      expect(result).toHaveProperty('note');
    } finally {
      setReplicaWaitForTests(40, 250);
    }
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
    mockedRequestBucketsUpload.impl = async (action: unknown) => {
      expect(action).toMatchObject({
        type: 'begin-upload',
        name: 'plan.md',
        size: Buffer.byteLength(contents),
      });
      phase = 'pending';
      return {
        session: 'upload-session',
        entryId: 11,
        url: 'https://upload.test/object-mine',
        headers: [['Content-Type', 'text/markdown']],
        expiresAt: '~2026.1.1',
      };
    };
    // The host settles with storage and publishes in one step, so the entry
    // is ready by the time %finish-upload returns -- no polling.
    mockedSendBucketsAction.impl = async (action: unknown) => {
      if ((action as BucketsAction).type === 'finish-upload') phase = 'ready';
    };
    // The only request this side makes now is the PUT itself.
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url === 'https://upload.test/object-mine') {
        // a redirect would be a second destination nobody checked
        expect(init?.redirect).toBe('error');
        expect(init?.body).toBeInstanceOf(Blob);
        expect(await (init?.body as Blob).text()).toBe(contents);
        return new Response('', { status: 200 });
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
    // Storage refuses through the host now, so the refusal arrives as the
    // answer to %begin-upload rather than from a call made here.
    mockedRequestBucketsUpload.impl = async () => {
      throw new Error('The Bucket host rejected this actor');
    };
    // Annotated, because a body that only throws infers Promise<never>, which
    // does not overlap typeof fetch well enough for the assertion.
    globalThis.fetch = (async (input): Promise<Response> => {
      throw new Error(`Unexpected fetch: ${String(input)}`);
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

  // The PUT URL comes from the Bucket's host, which is not trusted: a hosted
  // bot must not be pointed at its own network. A refused destination is a
  // failure after the grant, so the session is cancelled like any other.
  describe('refuses an upload destination the host should not choose', () => {
    const cases: Array<[string, string, string[] | null, string]> = [
      [
        'a private address',
        'https://upload.test/x',
        ['10.0.0.5'],
        'private or internal network',
      ],
      [
        'one private address among public ones',
        'https://upload.test/x',
        [PUBLIC_ADDRESS, '169.254.169.254'],
        'private or internal network',
      ],
      ['plain http', 'http://upload.test/x', null, 'non-https'],
      [
        'credentials in the URL',
        'https://user:pass@upload.test/x',
        null,
        'with credentials',
      ],
      [
        'an internal hostname',
        'https://metadata.google.internal/x',
        null,
        'local upload URL',
      ],
      [
        'a name that does not resolve',
        'https://upload.test/x',
        [],
        'does not resolve',
      ],
    ];
    for (const [label, url, addresses, message] of cases) {
      it(label, async () => {
        const directory = mkdtempSync(
          path.join(tmpdir(), 'tlon-buckets-upload-')
        );
        const filePath = path.join(directory, 'plan.md');
        writeFileSync(filePath, '# Project\n');
        if (addresses) {
          setUploadDestinationPolicyForTests({
            resolveHost: async () => addresses,
          });
        }
        const actions: BucketsAction[] = [];
        mockedGetBucket.impl = async () => snapshot();
        mockedRequestBucketsUpload.impl = async () => ({
          session: 'upload-session',
          entryId: 12,
          url,
          headers: [],
          expiresAt: '~2026.1.1',
        });
        mockedSendBucketsAction.impl = async (action: unknown) => {
          actions.push(action as BucketsAction);
        };
        let putAttempted = false;
        globalThis.fetch = (async () => {
          putAttempted = true;
          return new Response('', { status: 200 });
        }) as unknown as typeof fetch;

        try {
          await expect(
            createBucketsDeps().buckets.upload({
              target: TARGET,
              filePath,
              parentId: null,
            })
          ).rejects.toThrow(message);
          expect(putAttempted).toBe(false);
          expect(actions.map((action) => action.type)).toEqual([
            'cancel-upload',
          ]);
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      });
    }
  });

  it('refuses a bad --parent as an argument error, before opening a session', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    mockedGetBucket.impl = async () => snapshot();
    let opened = false;
    mockedRequestBucketsUpload.impl = async () => {
      opened = true;
      return undefined;
    };
    try {
      await expect(
        createBucketsDeps().buckets.upload({
          target: TARGET,
          filePath,
          parentId: 7,
        })
      ).rejects.toThrow('Parent 7 does not exist');
      expect(opened).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function grantedUpload(url = 'https://upload.test/object-mine') {
    mockedRequestBucketsUpload.impl = async () => ({
      session: 'upload-session',
      entryId: 11,
      url,
      headers: [],
      expiresAt: '~2026.1.1',
    });
  }

  // The host holds finish open while it verifies the receipt, so its answer
  // is the one most likely to be lost. Losing it must not become a failure.
  it('resubmits a finish whose answer was lost, under the same request id', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    setReplicaWaitForTests(2, 1);
    mockedGetBucket.impl = async () => snapshot();
    grantedUpload();
    const finishes: unknown[] = [];
    const sent: string[] = [];
    mockedSendBucketsAction.impl = async (
      action: unknown,
      requestId?: unknown
    ) => {
      const type = (action as BucketsAction).type;
      sent.push(type);
      if (type !== 'finish-upload') return undefined;
      finishes.push(requestId);
      if (finishes.length === 1) throw new Error('socket hang up');
      return { ok: null };
    };
    globalThis.fetch = (async () =>
      new Response('', { status: 200 })) as unknown as typeof fetch;

    try {
      await expect(
        createBucketsDeps().buckets.upload({
          target: TARGET,
          filePath,
          parentId: null,
        })
      ).resolves.toMatchObject({ id: 11, status: 'ready' });
      expect(finishes).toHaveLength(2);
      expect(finishes[0]).toBeDefined();
      expect(finishes[1]).toBe(finishes[0]);
      expect(sent).not.toContain('cancel-upload');
    } finally {
      setReplicaWaitForTests(40, 250);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not resubmit a finish the host refused', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    mockedGetBucket.impl = async () => snapshot();
    grantedUpload();
    let finishes = 0;
    mockedSendBucketsAction.impl = async (action: unknown) => {
      if ((action as BucketsAction).type !== 'finish-upload') return undefined;
      finishes += 1;
      throw new MockBucketsActionFailed(
        'invalid-input',
        'receipt did not match'
      );
    };
    globalThis.fetch = (async () =>
      new Response('', { status: 200 })) as unknown as typeof fetch;

    try {
      await expect(
        createBucketsDeps().buckets.upload({
          target: TARGET,
          filePath,
          parentId: null,
        })
      ).rejects.toThrow('receipt did not match');
      expect(finishes).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  // The upload endpoint is the untrusted host's choice. An error response
  // with an endless body must be read only as far as its code and message.
  it('reads no more than a bounded prefix of an upload error body', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    mockedGetBucket.impl = async () => snapshot();
    grantedUpload();
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(
          new TextEncoder().encode(
            pulled === 1 ? '<Code>SlowDown</Code>' : 'x'.repeat(64 * 1024)
          )
        );
      },
    });
    globalThis.fetch = (async () =>
      new Response(endless, {
        status: 503,
        statusText: 'Busy',
      })) as unknown as typeof fetch;

    try {
      await expect(
        createBucketsDeps().buckets.upload({
          target: TARGET,
          filePath,
          parentId: null,
        })
      ).rejects.toThrow('Object upload failed: 503 Busy (SlowDown)');
      expect(pulled).toBeLessThan(10);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports a created Bucket as created when the replica has not caught up', async () => {
    setReplicaWaitForTests(2, 1);
    mockedGetBuckets.impl = async () => [];
    mockedGetBucket.impl = async () => null;
    mockedGetGroup.impl = async () => ({ roles: [] });
    mockedSendBucketsAction.impl = async () => ({ ok: null });
    try {
      const result = await createBucketsDeps().buckets.create({
        group: GROUP,
        title: 'Project Files',
        name: 'project-files',
      });
      expect(result).toMatchObject({ nest: 'buckets/~zod/project-files' });
      expect(result).toHaveProperty('note');
    } finally {
      setReplicaWaitForTests(40, 250);
    }
  });

  it('cancels through the host when an upload fails after it is granted', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'tlon-buckets-upload-'));
    const filePath = path.join(directory, 'plan.md');
    writeFileSync(filePath, '# Project\n');
    const actions: BucketsAction[] = [];
    mockedGetBucket.impl = async () => snapshot();
    mockedRequestBucketsUpload.impl = async () => ({
      session: 'upload-session',
      entryId: 12,
      url: 'https://upload.test/object-mine',
      headers: [],
      expiresAt: '~2026.1.1',
    });
    mockedSendBucketsAction.impl = async (action: unknown) => {
      actions.push(action as BucketsAction);
    };
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url === 'https://upload.test/object-mine') {
        return new Response('nope', { status: 500, statusText: 'Error' });
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
      // One cancel, to the host, which releases the storage reservation.
      expect(actions).toContainEqual({
        type: 'cancel-upload',
        flag: TARGET.flag,
        sessionId: 'upload-session',
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
