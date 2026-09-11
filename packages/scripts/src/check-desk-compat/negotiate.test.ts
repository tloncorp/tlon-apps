import { describe, expect, it } from 'vitest';

import { memoryTree } from './git';
import { compareProtocols, protocolsInSource } from './negotiate';

// The `%9` below the agent:dbug line is past the declaration and must not be read.
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

const CHAT = [
  '%-  %-  agent:neg',
  '    :+  |',
  '      [~.chat-dms^%2 ~ ~]',
  '%-  agent:dbug',
].join('\n');

const LANYARD = [
  '%-  %-  agent:negotiate',
  '    [notify=| expose=[~.lanyard^%1 ~ ~] expect=[%verifier^[~.verifier^%0 ~ ~] ~ ~]]',
  '%-  agent:dbug',
].join('\n');

const tree = (v: string) =>
  memoryTree({ 'desk/app/groups.hoon': GROUPS(v), 'desk/app/chat.hoon': CHAT });

describe('protocolsInSource', () => {
  it('reads exposed and expected protocols, in both declaration forms', () => {
    const groups = protocolsInSource(GROUPS('3'));
    expect([...groups.get('groups')!, ...groups.get('channels')!]).toEqual([
      '3',
      '4',
    ]);
    const lanyard = protocolsInSource(LANYARD);
    expect([...lanyard.get('lanyard')!, ...lanyard.get('verifier')!]).toEqual([
      '1',
      '0',
    ]);
  });

  it('finds nothing in an agent that does not negotiate', () => {
    expect(protocolsInSource('|_  =bowl:gall\n--\n').size).toBe(0);
  });
});

describe('compareProtocols', () => {
  it('flags the 12.1.0 to 12.2.0 boundary, and only the protocol that moved', () => {
    expect(compareProtocols(tree('3'), tree('3'))).toEqual([]);
    expect(compareProtocols(tree('3'), tree('2'))).toEqual([
      {
        agent: 'groups',
        protocol: 'groups',
        clientDeskVersions: ['3'],
        n1Versions: ['2'],
      },
    ]);
  });
});
