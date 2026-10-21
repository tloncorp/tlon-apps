import { describe, expect, it } from 'vitest';

import {
  joinPromptFile,
  promptDisplayText,
  promptFileAccess,
  promptFileKeeper,
  splitPromptFile,
} from './botPromptFiles';

/**
 * The sync's upsert for one published block, transcribed from
 * tlon-hosting-oc's `upsertBlock` (tlonbot's `upsert_block` is equivalent):
 * every managed block goes, the rest stays, and the published block is
 * appended. A file without any marker is replaced whole.
 */
function syncUpsert(file: string, published: string) {
  const blockPattern =
    /(<!-- idempotency-marker:[^\s]+ -->)\n(.*?)\n<!-- \/idempotency-marker -->/gs;
  const [, marker, content] = [...published.matchAll(blockPattern)][0];
  const kept = file.includes('<!-- idempotency-marker:')
    ? file
        .replace(blockPattern, '')
        .replace(/<!-- idempotency-marker:[^\s]+ -->\n?/g, '')
        .replace(/\n+$/, '')
    : '';
  const written = `\n${marker}\n${content.replace(/\n+$/, '')}\n<!-- /idempotency-marker -->\n`;
  return `${kept}${written}`.replace(/^\n+/, '');
}

// As tlonbot publishes it: the whole file is one managed block.
const published = [
  '<!-- idempotency-marker:tlon-runtime:v10 -->',
  '',
  '## Who You Are',
  '',
  'You are ~pinser-botter.',
  '',
  '<!-- /idempotency-marker -->',
  '',
].join('\n');

// What a fresh workspace holds once the sync has written it.
const fresh = syncUpsert('', published);
const block = fresh.replace(/\n$/, '');

describe('splitPromptFile', () => {
  it('finds no additions in a fresh file', () => {
    expect(splitPromptFile(fresh)).toEqual({
      managedBlocks: [block],
      additions: '',
    });
  });

  it('collects text on either side of the managed block', () => {
    const file = `Call me Captain.\n${block}\n\nPrefer metric units.\n`;
    expect(splitPromptFile(file)).toEqual({
      managedBlocks: [block],
      additions: 'Call me Captain.\n\n\nPrefer metric units.',
    });
  });

  it('treats a file without markers as all additions', () => {
    expect(splitPromptFile('My own soul.\n')).toEqual({
      managedBlocks: [],
      additions: 'My own soul.',
    });
  });

  it('drops an opening marker that lost its block, as the sync does', () => {
    expect(
      splitPromptFile('<!-- idempotency-marker:tlon-x:v1 -->\nOrphan.\n')
        .additions
    ).toBe('Orphan.');
  });
});

describe('joinPromptFile', () => {
  it('writes additions above the managed block', () => {
    expect(joinPromptFile(fresh, 'Call me Captain.\n')).toBe(
      `Call me Captain.\n${block}\n`
    );
  });

  it('returns the fresh file when the additions are cleared', () => {
    const edited = joinPromptFile(fresh, 'Call me Captain.');
    expect(joinPromptFile(edited, '')).toBe(fresh);
    expect(joinPromptFile(edited, '\n\n')).toBe(fresh);
  });

  it('keeps the managed block byte for byte', () => {
    const joined = joinPromptFile(fresh, 'Call me Captain.');
    expect(splitPromptFile(joined)).toEqual({
      managedBlocks: [block],
      additions: 'Call me Captain.',
    });
  });

  it('writes what the next sync leaves unchanged', () => {
    for (const additions of ['', 'Call me Captain.', 'One.\n\nTwo.\n']) {
      const saved = joinPromptFile(fresh, additions);
      expect(syncUpsert(saved, published)).toBe(saved);
    }
  });

  it('drops marker comments from additions so the sync cannot take them', () => {
    const pasted = `Keep me.\n<!-- idempotency-marker:mine -->\nAnd me.\n<!-- /idempotency-marker -->`;
    const saved = joinPromptFile(fresh, pasted);
    expect(splitPromptFile(saved)).toEqual({
      managedBlocks: [block],
      additions: 'Keep me.\n\nAnd me.',
    });
    expect(splitPromptFile(syncUpsert(saved, published)).additions).toBe(
      'Keep me.\n\nAnd me.'
    );
  });

  it('writes additions that survive a sync publishing a new block', () => {
    const updated = published.replace('tlon-runtime:v10', 'tlon-runtime:v11');
    const synced = syncUpsert(
      joinPromptFile(fresh, 'Call me Captain.'),
      updated
    );
    expect(splitPromptFile(synced).additions).toBe('Call me Captain.');
    expect(synced).toContain('tlon-runtime:v11');
  });
});

describe('promptDisplayText', () => {
  it('drops the marker comments and keeps everything else', () => {
    expect(promptDisplayText(`Call me Captain.\n${block}\n`)).toBe(
      'Call me Captain.\n\n## Who You Are\n\nYou are ~pinser-botter.'
    );
  });
});

describe('promptFileAccess', () => {
  it('keeps the files Tlon must maintain read-only', () => {
    for (const name of [
      'AGENTS.md',
      'TOOLS.md',
      'BOOTSTRAP.md',
      'USER.md',
      'NEW.md',
    ]) {
      expect(promptFileAccess(name, fresh)).toEqual({
        kind: 'read-only',
        keptBy: 'tlon',
      });
    }
  });

  it("keeps the bot's memory read-only, as the bot's own to write", () => {
    expect(promptFileAccess('MEMORY.md', 'Learned.\n')).toEqual({
      kind: 'read-only',
      keptBy: 'bot',
    });
    expect(promptFileKeeper('MEMORY.md')).toBe('bot');
    expect(promptFileKeeper('SOUL.md')).toBe('tlon');
  });

  it('lets the owner add to personality and identity', () => {
    for (const name of ['SOUL.md', 'IDENTITY.md']) {
      expect(promptFileAccess(name, `Mine.\n${block}\n`)).toEqual({
        kind: 'additions',
        additions: 'Mine.',
      });
    }
  });

  it('counts whitespace alone as nothing added', () => {
    expect(promptFileAccess('SOUL.md', `   \n${block}\n`)).toEqual({
      kind: 'additions',
      additions: '',
    });
  });

  it('withholds editing from a file the sync will replace whole', () => {
    expect(promptFileAccess('SOUL.md', 'My own soul.\n')).toEqual({
      kind: 'unmanaged',
    });
  });
});
