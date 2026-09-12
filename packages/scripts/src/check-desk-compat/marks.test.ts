import { describe, expect, it } from 'vitest';

import { memoryTree } from './git';
import { markCandidates, matchMark, vendoredMarks } from './marks';
import { Verdict, loadDesk } from './match';

const PERU = `
git module base:
  pick:
    - pkg/base-dev/mar/noun.hoon
    - pkg/base-dev/lib/dbug.hoon
git module landscape:
  pick:
    - desk/mar/docket-0.hoon
`;
const VENDORED = vendoredMarks(PERU);

function desk(files: string[], clientApps?: string[]) {
  const tree: Record<string, string> = {
    'desk/desk.bill': ':~  %groups\n    %chat\n==\n',
    'desk/app/groups.hoon': '|_  =bowl:gall\n--\n',
    'desk/app/chat.hoon': '|_  =bowl:gall\n--\n',
    'desk/app/notes.hoon': '|_  =bowl:gall\n--\n',
  };
  for (const f of files) tree[f] = ':: mark\n';
  const client = Object.fromEntries(
    (clientApps ?? []).map((a) => [
      `desk/app/${a}.hoon`,
      '|_  =bowl:gall\n--\n',
    ])
  );
  return loadDesk(
    memoryTree(tree),
    'test',
    clientApps ? memoryTree(client) : undefined
  );
}

describe('vendoredMarks', () => {
  it('reads the mark picks and nothing else', () => {
    expect([...VENDORED].sort()).toEqual(['docket-0', 'noun']);
  });
});

describe('markCandidates', () => {
  it('enumerates every hyphen grouping', () => {
    expect(markCandidates('group-action-5')).toEqual([
      'desk/mar/group-action-5.hoon',
      'desk/mar/group/action-5.hoon',
      'desk/mar/group-action/5.hoon',
      'desk/mar/group/action/5.hoon',
    ]);
  });

  it('handles a flat mark', () => {
    expect(markCandidates('noun')).toEqual(['desk/mar/noun.hoon']);
  });
});

describe('matchMark — ownership by exclusion from peru, never by the refs under test', () => {
  it('does not treat an unresolved mark as a removal', () => {
    expect(matchMark(desk([]), VENDORED, 'groups', null).verdict).toBe(
      'UNVERIFIED'
    );
  });

  it.each<[string, string[], string, string, Verdict]>([
    [
      'nested at any hyphen grouping',
      ['desk/mar/chat/club/action-2.hoon'],
      'chat',
      'chat-club-action-2',
      'FOUND',
    ],
    // group-action-5 is on no pick list, so its absence is a removal.
    [
      'repo-owned and absent is a removal',
      ['desk/mar/group/action-4.hoon'],
      'groups',
      'group-action-5',
      'MISSING',
    ],
    // noun is on a pick list, so its absence from desk/mar proves nothing.
    ['vendored and absent proves nothing', [], 'groups', 'noun', 'UNVERIFIED'],
    [
      'a mark aimed at an out-of-desk app is not ours to judge',
      [],
      'settings',
      'settings-event',
      'UNVERIFIED',
    ],
    [
      'nor is one aimed at an agent missing from desk.bill',
      [],
      'notes',
      'notes-action',
      'UNVERIFIED',
    ],
  ])('%s', (_name, files, app, mark, verdict) => {
    expect(matchMark(desk(files), VENDORED, app, mark).verdict).toBe(verdict);
  });

  // The client's desk has %ping; N-1 does not. Nothing the client pokes at it
  // can be delivered, so a surviving mar file must not answer for the agent.
  it('reports a poke at a deleted agent, mar file or not', () => {
    for (const files of [[], ['desk/mar/ping/action.hoon']]) {
      const result = matchMark(
        desk(files, ['ping']),
        VENDORED,
        'ping',
        'ping-action'
      );
      expect(result.verdict).toBe('MISSING');
      expect(result.reason).toContain('no longer an agent');
      expect(result.failureMode).toBe('crash');
    }
  });

  it('calls no removal on an app the client never had', () => {
    // %settings lives in another desk; it was never ours to remove.
    expect(
      matchMark(desk([]), VENDORED, 'settings', 'settings-event').verdict
    ).toBe('UNVERIFIED');
  });

  it('claims only that the file exists, never that the agent accepts it', () => {
    const result = matchMark(
      desk(['desk/mar/group/action-5.hoon']),
      VENDORED,
      'groups',
      'group-action-5'
    );
    expect(result.reason).toBe('mark file present');
    expect(result.evidence).toBe('desk/mar/group/action-5.hoon');
  });
});
