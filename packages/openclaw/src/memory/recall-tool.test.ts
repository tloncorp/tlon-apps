import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { LcmSearchHit } from './lcm-reader.js';
import { createTlonRecallTool } from './recall-tool.js';
import { recordSpeakerForSession } from './speaker-bridge.js';

let workspaceDir: string;

function textOf(result: { content: { type: 'text'; text: string }[] }) {
  return result.content[0].text;
}

beforeEach(async () => {
  workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tlon-recall-'));
});

afterEach(async () => {
  await fs.rm(workspaceDir, { recursive: true, force: true });
});

describe('tlon_recall', () => {
  it('searches only the calling surface: base key derived through suffixes', async () => {
    const seen: string[][] = [];
    const tool = createTlonRecallTool({
      sessionKey:
        'agent:main:tlon:direct:~nec:thread:1.2:active-memory:ab12cd34ef56',
      workspaceDir,
      searchHistory: (params) => {
        seen.push(params.baseSessionKeys);
        return [];
      },
    });
    await tool.execute('call-1', { query: 'pacific' });
    expect(seen).toEqual([['agent:main:tlon:direct:~nec']]);
  });

  it('formats hits with provenance and returns NONE when empty', async () => {
    const hit: LcmSearchHit = {
      sessionKey: 'agent:main:tlon:direct:~nec',
      role: 'user',
      content: 'I moved to Pacific time in June',
      createdAt: '2026-06-02',
    };
    const tool = createTlonRecallTool({
      sessionKey: 'agent:main:tlon:direct:~nec',
      workspaceDir,
      searchHistory: () => [hit],
    });
    const result = await tool.execute('call-1', { query: 'pacific' });
    expect(textOf(result)).toContain('DM ~nec');
    expect(textOf(result)).toContain('Pacific time in June');

    const empty = createTlonRecallTool({
      sessionKey: 'agent:main:tlon:direct:~nec',
      workspaceDir,
      searchHistory: () => [],
    });
    expect(textOf(await empty.execute('c', { query: 'pacific' }))).toBe('NONE');
  });

  it('includes matches from allowed memory files only', async () => {
    const personDir = path.join(workspaceDir, 'memory', 'person');
    await fs.mkdir(personDir, { recursive: true });
    await fs.writeFile(
      path.join(personDir, '~nec.md'),
      'US/Pacific (moved June 2026)\n'
    );
    await fs.writeFile(
      path.join(personDir, '~nec.private.md'),
      'pacific secret: interviewing\n'
    );

    // In ~nec's DM: both tiers are in scope.
    const dmTool = createTlonRecallTool({
      sessionKey: 'agent:main:tlon:direct:~nec',
      workspaceDir,
      searchHistory: () => [],
    });
    const dmText = textOf(await dmTool.execute('c', { query: 'pacific' }));
    expect(dmText).toContain('US/Pacific');
    expect(dmText).toContain('interviewing');

    // In a channel where ~nec speaks: public tier only.
    const channelKey = 'agent:main:tlon:channel:chat/~zod/general';
    recordSpeakerForSession(channelKey, '~nec');
    const channelTool = createTlonRecallTool({
      sessionKey: `${channelKey}:active-memory:ab12cd34ef56`,
      workspaceDir,
      searchHistory: () => [],
    });
    const channelText = textOf(
      await channelTool.execute('c', { query: 'pacific' })
    );
    expect(channelText).toContain('US/Pacific');
    expect(channelText).not.toContain('interviewing');
  });

  it('returns NONE for non-tlon sessions and errors on empty query', async () => {
    const tool = createTlonRecallTool({
      sessionKey: 'agent:main:main',
      workspaceDir,
      searchHistory: () => {
        throw new Error('must not be called');
      },
    });
    expect(textOf(await tool.execute('c', { query: 'anything' }))).toBe('NONE');

    const dmTool = createTlonRecallTool({
      sessionKey: 'agent:main:tlon:direct:~nec',
      workspaceDir,
      searchHistory: () => [],
    });
    expect(textOf(await dmTool.execute('c', {}))).toContain('Error');
  });
});
