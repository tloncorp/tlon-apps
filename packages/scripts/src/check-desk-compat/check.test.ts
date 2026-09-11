import { describe, expect, it } from 'vitest';

import {
  Finding,
  ProtocolBump,
  markCoveredFallbacks,
  matchBump,
} from './check';
import { Dependency } from './extract';
import { ProtocolDifference } from './negotiate';

const difference = (
  over: Partial<ProtocolDifference> = {}
): ProtocolDifference => ({
  agent: 'groups',
  protocol: 'groups',
  clientDeskVersions: ['3'],
  n1Versions: ['2'],
  ...over,
});

const bump = (over: Partial<ProtocolBump> = {}): ProtocolBump => ({
  agent: 'groups',
  protocol: 'groups',
  from: '2',
  to: '3',
  issue: 'TLON-0000',
  ...over,
});

describe('matchBump', () => {
  it('allows exactly the bump an entry describes', () => {
    expect(matchBump(difference(), [bump()])).toBeDefined();
  });

  it('allows nothing else', () => {
    // A bump entry is permission for one transition, not for the protocol.
    expect(
      matchBump(difference({ clientDeskVersions: ['4'] }), [bump()])
    ).toBeUndefined();
    expect(
      matchBump(difference({ n1Versions: ['1'] }), [bump()])
    ).toBeUndefined();
    expect(matchBump(difference({ agent: 'chat' }), [bump()])).toBeUndefined();
    expect(
      matchBump(difference({ protocol: 'chat-dms' }), [bump()])
    ).toBeUndefined();
    expect(matchBump(difference(), [])).toBeUndefined();
  });
});

function finding(
  over: Partial<Dependency>,
  verdict: Finding['verdict'],
  line = 28
): Finding {
  return {
    verdict,
    rule: 'P1',
    reason: verdict === 'FOUND' ? 'served' : 'absent',
    sites: [{ file: 'packages/api/src/client/activityApi.ts', line }],
    dependency: {
      key: 'k',
      surface: 'poke',
      app: 'activity',
      path: null,
      mark: null,
      thread: null,
      site: { file: 'packages/api/src/client/activityApi.ts', line },
      text: '',
      ...over,
    },
  };
}

describe('markCoveredFallbacks', () => {
  it('excuses a guarded branch whose sibling at the same site is served', () => {
    const list = [
      finding(
        { key: 'poke activity activity-action-2', guard: 'supportsNotes()' },
        'MISSING'
      ),
      finding(
        {
          key: 'poke activity activity-action-1',
          guard: '! (supportsNotes())',
        },
        'FOUND'
      ),
    ];
    markCoveredFallbacks(list);
    expect(list[0].fallback).toEqual({
      coveredBy: 'poke activity activity-action-1',
      guard: 'supportsNotes()',
    });
  });

  it('does not excuse it when no branch at that site is served', () => {
    const list = [
      finding({ key: 'a', guard: 'supportsNotes()' }, 'MISSING'),
      finding({ key: 'b', guard: '! (supportsNotes())' }, 'MISSING'),
    ];
    markCoveredFallbacks(list);
    expect(list[0].fallback).toBeUndefined();
  });

  it('does not excuse an unguarded request that merely shares a file', () => {
    const list = [
      finding({ key: 'a' }, 'MISSING'),
      finding({ key: 'b' }, 'FOUND'),
    ];
    markCoveredFallbacks(list);
    expect(list[0].fallback).toBeUndefined();
  });

  it('does not excuse a branch served only at some other call site', () => {
    const list = [
      finding({ key: 'a', guard: 'g' }, 'MISSING', 28),
      finding({ key: 'b', guard: '! (g)' }, 'FOUND', 99),
    ];
    markCoveredFallbacks(list);
    expect(list[0].fallback).toBeUndefined();
  });
});
