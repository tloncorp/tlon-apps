import { describe, expect, it } from 'bun:test';

import { SurfaceError } from './commands/surface-common';
import {
  SCOPE_FILE_ENV,
  type SurfaceWriteScope,
  assertPreStateInScope,
  assertWriteInScope,
  loadSurfaceWriteScope,
  surfacePreStateIdentity,
} from './surface-write-scope';

const sha256Hex = (bytes: Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

function loading(
  contents: string | Error,
  env: Record<string, string | undefined> = { [SCOPE_FILE_ENV]: '/fence.json' }
) {
  return () =>
    loadSurfaceWriteScope(env, () => {
      if (contents instanceof Error) throw contents;
      return contents;
    });
}

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof SurfaceError) return error.code;
    throw error;
  }
  throw new Error('expected a refusal, got none');
}

describe('loadSurfaceWriteScope', () => {
  it('is unfenced when the environment names no scope file', () => {
    expect(loadSurfaceWriteScope({}, () => '{}')).toBeNull();
    expect(loadSurfaceWriteScope({ [SCOPE_FILE_ENV]: '  ' }, () => '{}')).toBe(
      null
    );
  });

  it('reads a channel, a pre-state and a group list', () => {
    const scope = loading(
      JSON.stringify({
        channel: 'chat/~zod/dash-0001',
        preState: 'spec:abc',
        groups: ['~zod/dashboards'],
      })
    )();
    expect(scope).toEqual({
      source: '/fence.json',
      channel: 'chat/~zod/dash-0001',
      preState: 'spec:abc',
      groups: ['~zod/dashboards'],
    });
  });

  // The property that separates a fence from decoration. Every other failure
  // mode in this file is a typo; this one is the difference between "the
  // operator's bound is in force" and "the operator believes it is."
  it('refuses rather than falling back to unfenced when the file cannot be read', () => {
    expect(codeOf(loading(new Error('ENOENT')))).toBe('write-out-of-scope');
  });

  it('refuses a scope file that is not JSON, or not an object', () => {
    expect(codeOf(loading('not json'))).toBe('write-out-of-scope');
    expect(codeOf(loading('[]'))).toBe('write-out-of-scope');
    expect(codeOf(loading('null'))).toBe('write-out-of-scope');
  });

  it('refuses a scope that fences nothing', () => {
    expect(codeOf(loading('{}'))).toBe('write-out-of-scope');
  });

  it('refuses a pre-state with no channel to attach it to', () => {
    expect(codeOf(loading(JSON.stringify({ preState: 'spec:abc' })))).toBe(
      'write-out-of-scope'
    );
  });

  it('refuses malformed field types', () => {
    expect(codeOf(loading(JSON.stringify({ channel: 42 })))).toBe(
      'write-out-of-scope'
    );
    expect(codeOf(loading(JSON.stringify({ groups: 'a-group' })))).toBe(
      'write-out-of-scope'
    );
    expect(codeOf(loading(JSON.stringify({ groups: ['~zod/a', ''] })))).toBe(
      'write-out-of-scope'
    );
  });

  // An empty list is a scope, not an absent one: "write nowhere" has to be
  // expressible, or a harness winding a fence down to nothing would silently
  // wind it down to everything.
  it('treats an empty group list as fencing everything out', () => {
    const scope = loading(JSON.stringify({ groups: [] }))();
    expect(scope?.groups).toEqual([]);
    expect(
      codeOf(() =>
        assertWriteInScope(scope, {
          channelId: 'chat/~zod/dash-0001',
          groupId: '~zod/dashboards',
          operation: 'surface publish',
        })
      )
    ).toBe('write-out-of-scope');
  });
});

describe('assertWriteInScope', () => {
  const fenced: SurfaceWriteScope = {
    source: '/fence.json',
    channel: 'chat/~zod/dash-0001',
    preState: null,
    groups: ['~zod/dashboards'],
  };

  it('permits the bound channel in the scoped group', () => {
    expect(() =>
      assertWriteInScope(fenced, {
        channelId: 'chat/~zod/dash-0001',
        groupId: '~zod/dashboards',
        operation: 'surface publish',
      })
    ).not.toThrow();
  });

  it('permits everything when unfenced', () => {
    expect(() =>
      assertWriteInScope(null, {
        channelId: 'chat/~zod/anything',
        groupId: '~zod/anywhere',
        operation: 'surface publish',
      })
    ).not.toThrow();
  });

  it('refuses a sibling channel in the same group, naming both', () => {
    let message = '';
    try {
      assertWriteInScope(fenced, {
        channelId: 'chat/~zod/dash-0002',
        groupId: '~zod/dashboards',
        operation: 'surface publish',
      });
    } catch (error) {
      message = (error as SurfaceError).message;
    }
    expect(message).toContain('chat/~zod/dash-0002');
    expect(message).toContain('chat/~zod/dash-0001');
  });

  it('refuses a group the process is not scoped to', () => {
    expect(
      codeOf(() =>
        assertWriteInScope(fenced, {
          channelId: 'chat/~zod/dash-0001',
          groupId: '~zod/somewhere-else',
          operation: 'surface publish',
        })
      )
    ).toBe('write-out-of-scope');
  });

  it('fences by group alone when no channel is bound', () => {
    const byGroup: SurfaceWriteScope = {
      source: '/fence.json',
      channel: null,
      preState: null,
      groups: ['~zod/dashboards'],
    };
    expect(() =>
      assertWriteInScope(byGroup, {
        channelId: 'chat/~zod/anything',
        groupId: '~zod/dashboards',
        operation: 'surface create',
      })
    ).not.toThrow();
    expect(
      codeOf(() =>
        assertWriteInScope(byGroup, {
          channelId: 'chat/~zod/anything',
          groupId: '~zod/elsewhere',
          operation: 'surface create',
        })
      )
    ).toBe('write-out-of-scope');
  });
});

describe('assertPreStateInScope', () => {
  const bound: SurfaceWriteScope = {
    source: '/fence.json',
    channel: 'chat/~zod/dash-0001',
    preState: 'spec:aaa',
    groups: null,
  };

  it('permits the bound channel at the bound pre-state', () => {
    expect(() =>
      assertPreStateInScope(bound, {
        channelId: 'chat/~zod/dash-0001',
        observed: 'spec:aaa',
        operation: 'surface publish',
      })
    ).not.toThrow();
  });

  it('refuses when the channel has moved, naming both identities', () => {
    let error: SurfaceError | null = null;
    try {
      assertPreStateInScope(bound, {
        channelId: 'chat/~zod/dash-0001',
        observed: 'spec:bbb',
        operation: 'surface publish',
      });
    } catch (thrown) {
      error = thrown as SurfaceError;
    }
    expect(error?.code).toBe('pre-state-moved');
    expect(error?.message).toContain('spec:aaa');
    expect(error?.message).toContain('spec:bbb');
  });

  it('says nothing about a channel it is not bound to', () => {
    // The channel fence, not this one, is what refuses a write elsewhere.
    // Reporting a pre-state mismatch for an unbound channel would be an
    // assertion about a claim nobody made.
    expect(() =>
      assertPreStateInScope(bound, {
        channelId: 'chat/~zod/dash-0002',
        observed: 'spec:bbb',
        operation: 'surface publish',
      })
    ).not.toThrow();
  });
});

describe('surfacePreStateIdentity', () => {
  it('hashes the raw definition cell, byte for byte', () => {
    const raw = '{"surfaceId":"a","unknownKey":1}';
    expect(
      surfacePreStateIdentity({
        description: raw,
        hasSpec: true,
        postHead: null,
        sha256Hex,
      })
    ).toBe(`spec:${sha256Hex(new TextEncoder().encode(raw))}`);
  });

  // D72, restated as a property of the binding: the identity has to be taken
  // over what the ship HOLDS, because two cells that differ only in a key the
  // schema strips would otherwise be indistinguishable, and a binding that
  // cannot distinguish them is not binding anything.
  it('distinguishes two cells that a validating read would flatten together', () => {
    const withUnknown = '{"surfaceId":"a","unknownKey":1}';
    const without = '{"surfaceId":"a"}';
    expect(
      surfacePreStateIdentity({
        description: withUnknown,
        hasSpec: true,
        postHead: null,
        sha256Hex,
      })
    ).not.toBe(
      surfacePreStateIdentity({
        description: without,
        hasSpec: true,
        postHead: null,
        sha256Hex,
      })
    );
  });

  it('identifies an unpublished channel by its post head instead', () => {
    expect(
      surfacePreStateIdentity({
        description: null,
        hasSpec: false,
        postHead: 'seq:12',
        sha256Hex,
      })
    ).toBe('unpublished:seq:12');
    expect(
      surfacePreStateIdentity({
        description: null,
        hasSpec: false,
        postHead: null,
        sha256Hex,
      })
    ).toBe('unpublished:empty');
  });
});
