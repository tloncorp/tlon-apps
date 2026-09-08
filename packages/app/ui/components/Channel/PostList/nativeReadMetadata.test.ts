import { describe, expect, it } from 'vitest';

import {
  emptyReadBlockLineage,
  emptyReadMembership,
  readScopeDescriptor,
  reconcileReadBlocks,
  reconcileReadMembership,
} from './nativeReadMetadata';

const paragraph = (text: string) => ({ type: 'paragraph', text });
const blocks = (...text: string[]) => text.map(paragraph);
const scopeRevision = (membership: Parameters<typeof readScopeDescriptor>[3]) =>
  readScopeDescriptor(
    { version: 1, scope: 's', visit: 'v' },
    '1',
    'read',
    membership
  )?.dataRevision;

describe('native reading membership', () => {
  it('timing sessions change diagnostics without replacing reading identity', () => {
    const members = reconcileReadMembership(emptyReadMembership, ['a']);
    const binding = { version: 1 as const, scope: 's', visit: 'v' };
    const plain = readScopeDescriptor(binding, '1', 'read', members)!;
    const first = readScopeDescriptor(binding, '1', 'read', members, 'r13.a')!;
    const next = readScopeDescriptor(binding, '1', 'read', members, 'r13.b')!;
    expect(first).toEqual({ ...plain, diagnosticTimingSession: 'r13.a' });
    expect(next).toEqual({ ...plain, diagnosticTimingSession: 'r13.b' });
    expect(next.rows).toBe(plain.rows);
    expect(plain).not.toHaveProperty('diagnosticTimingSession');
    expect(first.diagnosticTimingSession).toBe('r13.a');
  });
  it.each(['', 'x'.repeat(129), 'bad/token', 'bad token', 'bad\n', 'é'])(
    'invalid timing session %j leaves the ordinary descriptor valid',
    (session) => {
      const members = reconcileReadMembership(emptyReadMembership, ['a']);
      const binding = { version: 1 as const, scope: 's', visit: 'v' };
      expect(
        readScopeDescriptor(binding, '1', 'read', members, session)
      ).toEqual(readScopeDescriptor(binding, '1', 'read', members));
    }
  );
  it('keeps the scope revision compact for a realistic loaded history', () => {
    const keys = Array.from(
      { length: 300 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    );
    const membership = reconcileReadMembership(emptyReadMembership, keys);
    expect(JSON.stringify(membership.rows).length).toBeGreaterThan(16384);
    expect(scopeRevision(membership)!.length).toBeLessThanOrEqual(32);
    expect(membership.rows.map((row) => row.key)).toEqual(keys);
  });
  it('reorder and return advance the scope generation without replacing rows', () => {
    const first = reconcileReadMembership(emptyReadMembership, ['a', 'b']);
    const second = reconcileReadMembership(first, ['b', 'a']);
    const restored = reconcileReadMembership(second, ['a', 'b']);
    expect(new Set([first, second, restored].map(scopeRevision)).size).toBe(3);
    expect(restored.rows[0]).toBe(first.rows[0]);
    expect(restored.rows[1]).toBe(first.rows[1]);
  });
  it('invalid membership and recovery cannot reuse a scope generation', () => {
    const first = reconcileReadMembership(emptyReadMembership, ['a']);
    const invalid = reconcileReadMembership(first, ['a', 'a']);
    const recovered = reconcileReadMembership(invalid, ['a']);
    expect(scopeRevision(invalid)).toBeUndefined();
    expect(scopeRevision(recovered)).not.toBe(scopeRevision(first));
  });
  it('an abandoned candidate does not consume the committed generation', () => {
    const committed = reconcileReadMembership(emptyReadMembership, ['a']);
    const before = scopeRevision(committed);
    const candidate = reconcileReadMembership(committed, ['a', 'abandoned']);
    const accepted = reconcileReadMembership(committed, ['a', 'accepted']);
    expect(scopeRevision(committed)).toBe(before);
    expect(scopeRevision(accepted)).toBe(scopeRevision(candidate));
    expect(reconcileReadMembership(committed, ['a'])).toBe(committed);
  });
  it('generation remains exact past the numeric safe-integer boundary', () => {
    const previous = {
      ...reconcileReadMembership(emptyReadMembership, ['a']),
      generation: '9007199254740991',
    };
    const next = reconcileReadMembership(previous, ['b']);
    const later = reconcileReadMembership(next, ['a']);
    expect(scopeRevision(next)).toBe('9007199254740992');
    expect(scopeRevision(later)).toBe('9007199254740993');
    expect(previous.generation).toBe('9007199254740991');
  });
  it('generation carries across all-nine decimal digits without aliasing', () => {
    const previous = {
      ...emptyReadMembership,
      generation: '99999999999999999999',
    };
    expect(scopeRevision(reconcileReadMembership(previous, ['a']))).toBe(
      '100000000000000000000'
    );
  });
  it('retains incarnations across reorder and fresh copies', () => {
    const first = reconcileReadMembership(emptyReadMembership, ['a', 'b']);
    expect(reconcileReadMembership(first, ['a', 'b'])).toBe(first);
    const reordered = reconcileReadMembership(first, ['b', 'a']);
    expect(reordered.rows).toEqual([first.rows[1], first.rows[0]]);
  });
  it('a removed and reinserted key gets a new incarnation', () => {
    const first = reconcileReadMembership(emptyReadMembership, ['a', 'b']);
    const removed = reconcileReadMembership(first, ['b']);
    const restored = reconcileReadMembership(removed, ['a', 'b']);
    expect(restored.rows[0].revision).not.toBe(first.rows[0].revision);
    expect(restored.rows[1]).toBe(first.rows[1]);
  });
  it.each([['a', 'a'], ['']])(
    'invalid keys %j cannot declare all rows removed',
    (...keys) => {
      const first = reconcileReadMembership(emptyReadMembership, ['a']);
      const invalid = reconcileReadMembership(first, keys);
      expect(
        readScopeDescriptor(
          { version: 1, scope: 's', visit: 'v' },
          '1',
          'read',
          invalid
        )
      ).toBeNull();
    }
  );
  it('copies caller membership and leaves previous snapshots immutable', () => {
    const keys = ['a'];
    const first = reconcileReadMembership(emptyReadMembership, keys);
    keys.push('b');
    expect(first.keys).toEqual(['a']);
    expect(emptyReadMembership.rows).toEqual([]);
  });
  it('a new intent changes ownership without changing data identity', () => {
    const members = reconcileReadMembership(emptyReadMembership, ['a']);
    const binding = { version: 1 as const, scope: 's', visit: 'v' };
    const target = readScopeDescriptor(binding, '1', 'target', members)!;
    const read = readScopeDescriptor(binding, '2', 'read', members)!;
    expect(read.rows).toBe(target.rows);
    expect(read.dataRevision).toBe(target.dataRevision);
    expect(read.intent).not.toBe(target.intent);
  });
});

describe('rendered block lineage', () => {
  it('unchanged repeated paragraphs retain identity', () => {
    const first = reconcileReadBlocks(
      emptyReadBlockLineage,
      blocks('same', 'same')
    );
    expect(reconcileReadBlocks(first, blocks('same', 'same'))).toBe(first);
  });
  it('unique blocks retain identity through insertion and reorder', () => {
    const first = reconcileReadBlocks(emptyReadBlockLineage, blocks('a', 'b'));
    const next = reconcileReadBlocks(first, blocks('b', 'new', 'a'));
    expect(next.blocks[0].id).toBe(first.blocks[1].id);
    expect(next.blocks[2].id).toBe(first.blocks[0].id);
    expect(first.blocks.map((b) => b.id)).not.toContain(next.blocks[1].id);
  });
  it('a single edited paragraph retains identity, with the actual new revision', () => {
    const first = reconcileReadBlocks(
      emptyReadBlockLineage,
      blocks('left', 'body', 'right')
    );
    const next = reconcileReadBlocks(
      first,
      blocks('left', 'edited body', 'right')
    );
    expect(next.blocks[1].id).toBe(first.blocks[1].id);
    expect(next.blocks[1].revision).toBe(
      JSON.stringify(paragraph('edited body'))
    );
    expect(next.unresolvedBlockIds).toEqual([]);
  });
  it('unambiguous deletion permits native fallback', () => {
    const first = reconcileReadBlocks(
      emptyReadBlockLineage,
      blocks('left', 'body', 'right')
    );
    const next = reconcileReadBlocks(first, blocks('left', 'right'));
    expect(next.blocks.map((b) => b.id)).not.toContain(first.blocks[1].id);
    expect(next.unresolvedBlockIds).not.toContain(first.blocks[1].id);
  });
  it('a split does not invent deletion of the original witness', () => {
    const first = reconcileReadBlocks(
      emptyReadBlockLineage,
      blocks('left', 'body', 'right')
    );
    const next = reconcileReadBlocks(
      first,
      blocks('left', 'part one', 'part two', 'right')
    );
    expect(next.unresolvedBlockIds).toContain(first.blocks[1].id);
    expect(next.blocks.map((b) => b.id)).not.toContain(first.blocks[1].id);
  });
  it('a merge preserves uncertainty for both old blocks', () => {
    const first = reconcileReadBlocks(emptyReadBlockLineage, blocks('a', 'b'));
    const next = reconcileReadBlocks(first, blocks('merged'));
    expect(next.unresolvedBlockIds).toEqual(first.blocks.map((b) => b.id));
  });
  it('ambiguous repeated-text deletion is unavailable', () => {
    const first = reconcileReadBlocks(
      emptyReadBlockLineage,
      blocks('same', 'same')
    );
    const next = reconcileReadBlocks(first, blocks('same'));
    expect(next.unresolvedBlockIds).toEqual(first.blocks.map((b) => b.id));
  });
  it('a later render cannot erase prior uncertainty', () => {
    const first = reconcileReadBlocks(emptyReadBlockLineage, blocks('a', 'b'));
    const merged = reconcileReadBlocks(first, blocks('merged'));
    const later = reconcileReadBlocks(merged, blocks('edited merged'));
    expect(later.unresolvedBlockIds).toEqual(merged.unresolvedBlockIds);
  });
  it('an aborted candidate does not consume identity from the committed value', () => {
    const committed = reconcileReadBlocks(emptyReadBlockLineage, blocks('a'));
    reconcileReadBlocks(committed, blocks('a', 'abandoned'));
    const result = reconcileReadBlocks(committed, blocks('a', 'committed'));
    expect(result.nextId).toBe(committed.nextId + 1);
    expect(committed.blocks).toHaveLength(1);
  });
  it('replacing a block kind keeps the old witness unavailable', () => {
    const first = reconcileReadBlocks(emptyReadBlockLineage, blocks('a'));
    const next = reconcileReadBlocks(first, [{ type: 'image', src: 'asset' }]);
    expect(next.blocks[0].id).not.toBe(first.blocks[0].id);
    expect(next.unresolvedBlockIds).toContain(first.blocks[0].id);
  });
  it('complete content deletion is authoritative', () => {
    const first = reconcileReadBlocks(emptyReadBlockLineage, blocks('a', 'b'));
    const next = reconcileReadBlocks(first, []);
    expect(next.blocks).toEqual([]);
    expect(next.unresolvedBlockIds).toEqual([]);
  });
});
