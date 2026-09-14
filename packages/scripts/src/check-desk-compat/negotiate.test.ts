import { describe, expect, it } from 'vitest';

import { WORKTREE_REF, memoryTree, sameRef } from './git';
import { chargeInSource, compareProtocols } from './negotiate';

describe('sameRef', () => {
  it('sees one commit spelled two ways as one tree', () => {
    // The staging self-check passes `$GITHUB_SHA` where another run says
    // `v12.2.0`; comparing the strings reports a tree as differing from
    // itself, and every protocolBumps entry then looks stale.
    expect(sameRef('v12.2.0', 'v12.2.0')).toBe(true);
    expect(sameRef(WORKTREE_REF, WORKTREE_REF)).toBe(true);
    expect(sameRef('v12.2.0', 'v12.1.0')).toBe(false);
    // The working tree is not any commit, however it is spelled.
    expect(sameRef(WORKTREE_REF, 'v12.2.0')).toBe(false);
  });
});

// The `%9` below the agent:dbug line is past the declaration and must not be
// read. `%groups` exposes `~.groups` and expects it of itself and of
// `%channels`, which is exactly how the desk writes it.
const GROUPS = (v: string) =>
  [
    '%-  %-  agent:neg',
    '    :+  notify=&',
    `      [~.groups^%${v} ~ ~]`,
    '    %-  my',
    `    :~  %groups^[~.groups^%${v} ~ ~]`,
    '        %channels^[~.channels^%4 ~ ~]',
    '    ==',
    '%-  agent:dbug',
    '++  peek  [~.groups^%9 ~ ~]',
  ].join('\n');

const CHANNELS = (expectsGroups: string) =>
  [
    '%-  %-  agent:neg',
    '    :+  notify=&',
    '      [~.channels^%4 ~ ~]',
    '    %-  my',
    `    :~  %groups^[~.groups^%${expectsGroups} ~ ~]`,
    '    ==',
    '%-  agent:dbug',
  ].join('\n');

describe('reading a charge', () => {
  it('separates what an agent exposes from what it expects of each peer', () => {
    // `agent:neg` takes the two maps separately and they mean opposite
    // things; unioning the atoms conflates them.
    const groups = chargeInSource(GROUPS('3'));
    expect([...groups.exposed]).toEqual([['groups', '3']]);
    expect([...groups.expected.get('groups')!]).toEqual([['groups', '3']]);
    expect([...groups.expected.get('channels')!]).toEqual([['channels', '4']]);
  });

  it('reads every spelling the desk uses for a peer', () => {
    // `%chat^[…]`, `~.contacts^[…]`, `(my %groups^[…] ~)` and the one-line
    // `expose=/expect=` form all occur in desk/app today.
    const chat = chargeInSource(
      [
        '%-  %-  agent:neg',
        '    :+  |',
        '      [~.chat-dms^%2 ~ ~]',
        '    [%chat^[~.chat-dms^%2 ~ ~] ~ ~]',
        '%-  agent:dbug',
      ].join('\n')
    );
    expect([...chat.exposed]).toEqual([['chat-dms', '2']]);
    expect([...chat.expected.get('chat')!]).toEqual([['chat-dms', '2']]);

    const contacts = chargeInSource(
      [
        '%-  %-  agent:neg',
        '    :+  notify=&',
        '      [~.contacts^%1 ~ ~]',
        '    [~.contacts^[~.contacts^%1 ~ ~] ~ ~]',
        '%-  agent:dbug',
      ].join('\n')
    );
    expect([...contacts.exposed]).toEqual([['contacts', '1']]);
    expect([...contacts.expected.get('contacts')!]).toEqual([
      ['contacts', '1'],
    ]);

    const lanyard = chargeInSource(
      [
        '%-  %-  agent:negotiate',
        '    [notify=| expose=[~.lanyard^%1 ~ ~] expect=[%verifier^[~.verifier^%0 ~ ~] ~ ~]]',
        '%-  agent:dbug',
      ].join('\n')
    );
    expect([...lanyard.exposed]).toEqual([['lanyard', '1']]);
    expect([...lanyard.expected.get('verifier')!]).toEqual([['verifier', '0']]);

    const server = chargeInSource(
      [
        '%-  %-  agent:neg',
        '    :+  notify=&',
        '      [~.channels^%4 ~ ~]',
        '    (my %groups^[~.groups^%3 ~ ~] ~)',
        '%-  agent:dbug',
      ].join('\n')
    );
    expect([...server.exposed]).toEqual([['channels', '4']]);
    expect([...server.expected.get('groups')!]).toEqual([['groups', '3']]);
  });

  it('reads a charge written on the line that opens the wrapper', () => {
    const inline = chargeInSource(
      ['%-  %-  agent:neg  [~.groups^%4 ~ ~]', '%-  agent:dbug'].join('\n')
    );
    expect([...inline.exposed]).toEqual([['groups', '4']]);
  });

  it('does not read a commented-out charge as a declaration', () => {
    const commented = chargeInSource(
      [
        '%-  %-  agent:neg',
        '    :+  notify=&',
        '      [~.groups^%3 ~ ~]  :: was [~.groups^%2 ~ ~]',
        '%-  agent:dbug',
      ].join('\n')
    );
    expect([...commented.exposed]).toEqual([['groups', '3']]);
  });

  it('finds nothing in an agent that does not negotiate', () => {
    const none = chargeInSource('|_  =bowl:gall\n--\n');
    expect(none.exposed.size + none.expected.size).toBe(0);
  });
});

describe('comparing two desks', () => {
  const desk = (groupsVersion: string, channelsExpects = groupsVersion) =>
    memoryTree({
      'desk/app/groups.hoon': GROUPS(groupsVersion),
      'desk/app/channels.hoon': CHANNELS(channelsExpects),
    });

  it('reports an expectation the other side does not expose', () => {
    // %groups went ~.groups^%2 to ^%3; every agent that expects `%groups` is
    // then talking to a peer that answers with the other number.
    const differences = compareProtocols(desk('3'), desk('2'));
    expect(
      differences.map((d) => `${d.agent}->${d.peer} ${d.protocol}`)
    ).toEqual(['channels->groups groups', 'groups->groups groups']);
    expect(differences[0].clientDeskVersions).toEqual(['3']);
    expect(differences[0].n1Versions).toEqual(['2']);
  });

  it('says nothing when both sides already agree', () => {
    expect(compareProtocols(desk('3'), desk('3'))).toEqual([]);
  });

  it('does not call a newly declared expectation a version change', () => {
    // The candidate starts expecting `%channels`, which the N-1 desk already
    // exposes at that version. Unioning the atoms reported that as a
    // difference and blocked a release that was in fact compatible.
    const before = memoryTree({
      'desk/app/groups.hoon': [
        '%-  %-  agent:neg',
        '    :+  notify=&',
        '      [~.groups^%3 ~ ~]',
        '    %-  my',
        '    :~  %groups^[~.groups^%3 ~ ~]',
        '    ==',
        '%-  agent:dbug',
      ].join('\n'),
      'desk/app/channels.hoon': CHANNELS('3'),
    });
    expect(compareProtocols(desk('3'), before)).toEqual([]);
    expect(compareProtocols(before, desk('3'))).toEqual([]);
  });
});
