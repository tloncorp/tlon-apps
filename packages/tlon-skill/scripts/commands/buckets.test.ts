import { describe, expect, it } from 'bun:test';

import { BUCKETS_HELP, type BucketsDeps, run } from './buckets';

function makeDeps() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    create: [] as unknown[],
    files: [] as unknown[],
    upload: [] as unknown[],
  };
  const deps: BucketsDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
    },
    buckets: {
      list: async () => [],
      show: async () => ({}) as never,
      files: async (...args) => {
        calls.files.push(args);
        return [];
      },
      search: async () => [],
      create: async (input) => {
        calls.create.push(input);
        return { nest: `buckets/${input.group.host}/${input.name ?? 'made'}` };
      },
      createFolder: async () => ({}),
      upload: async (input) => {
        calls.upload.push(input);
        return { id: 12, status: 'ready' };
      },
      read: async () => '# Bucket file',
      rename: async () => ({}),
      move: async () => ({}),
      delete: async () => ({}),
      setWriters: async () => ({}),
    },
  };
  return {
    calls,
    deps,
    stderr: () => stderr.join(''),
    stdout: () => stdout.join(''),
  };
}

describe('buckets command', () => {
  it('prints help without authenticating', async () => {
    const context = makeDeps();
    expect(await run(['--help'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(`${BUCKETS_HELP}\n`);
    expect(context.calls.authenticate).toBe(0);
  });

  it('rejects malformed nests before authenticating', async () => {
    const context = makeDeps();
    expect(await run(['files', 'chat/~zod/files'], context.deps)).toBe(1);
    expect(context.stderr()).toContain('Expected buckets/~host/name');
    expect(context.calls.authenticate).toBe(0);
  });

  it('normalizes the bot-visible Bucket target and root parent', async () => {
    const context = makeDeps();
    expect(
      await run(
        ['files', 'buckets/zod/project-files', '--parent', 'root'],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.files).toEqual([
      [
        {
          flag: { host: '~zod', name: 'project-files' },
          nest: 'buckets/~zod/project-files',
        },
        null,
      ],
    ]);
  });

  it('routes uploads through the Bucket operation rather than generic storage', async () => {
    const context = makeDeps();
    expect(
      await run(
        [
          'upload',
          'buckets/~zod/project-files',
          './plan.md',
          '--parent',
          '7',
          '--name',
          'launch-plan.md',
          '-t',
          'text/markdown',
        ],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.upload).toEqual([
      {
        kind: 'upload',
        target: {
          flag: { host: '~zod', name: 'project-files' },
          nest: 'buckets/~zod/project-files',
        },
        filePath: './plan.md',
        parentId: 7,
        name: 'launch-plan.md',
        mime: 'text/markdown',
      },
    ]);
    expect(context.stdout()).toContain('"status": "ready"');
  });

  it('creates a Bucket on the group host without owner credentials', async () => {
    const context = makeDeps();
    expect(
      await run(
        ['create', 'zod/team', 'Shared', 'Files', '--name', 'shared-files'],
        context.deps
      )
    ).toBe(0);
    expect(context.calls.create).toEqual([
      {
        group: { host: '~zod', name: 'team' },
        title: 'Shared Files',
        name: 'shared-files',
      },
    ]);
  });
});
