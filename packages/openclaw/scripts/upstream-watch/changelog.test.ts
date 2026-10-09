import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { dedupeBullets, parseChangelog } from './changelog.ts';

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('parseChangelog', () => {
  it('keeps the curated sections of a regular release', () => {
    const bullets = parseChangelog(fixture('changelog-9.7.md'), '2026.9.7');
    expect(bullets.length).toBeGreaterThanOrEqual(300);
    expect(bullets).toHaveLength(316);
    expect(new Set(bullets.map((b) => b.section))).toEqual(
      new Set([
        'Highlights',
        'Changes',
        'Fixes',
        'Known issues',
        'Upcoming deprecations',
      ])
    );
    // 9.7's Highlights carry PR sets of their own, so nothing merges
    expect(dedupeBullets(bullets)).toHaveLength(316);
  });

  it('drops the PR record, strips credits and keeps PR numbers', () => {
    const bullets = parseChangelog(fixture('changelog-9.8.md'), '2026.9.8');
    expect(bullets).toHaveLength(13);
    expect(bullets.some((b) => b.text.startsWith('**PR #'))).toBe(false);
    expect(bullets.some((b) => b.text.includes('Thanks @'))).toBe(false);
    expect(bullets[2]).toMatchObject({
      release: '2026.9.8',
      section: 'Highlights',
      prs: [161260],
    });
    expect(bullets[2].text).toMatch(/\(#161260\)$/);
  });

  it('reads issue references outside the PR group as text, not PRs', () => {
    const [bullet] = parseChangelog(
      '### Fixes\n\n- Thing: works. Fixes #1 and #2. (#10, #11) Thanks @a.\n',
      '2026.1.1'
    );
    expect(bullet.prs).toEqual([10, 11]);
  });

  it('ignores bullets before the first curated heading and under level-4 PR headings', () => {
    const bullets = parseChangelog(
      [
        '## 2026.1.1',
        '- stray (#1)',
        '### Fixes',
        '- kept (#2)',
        '#### Pull requests',
        '- **PR #3**',
      ].join('\n'),
      '2026.1.1'
    );
    expect(bullets.map((b) => b.text)).toEqual(['kept (#2)']);
  });
});

describe('dedupeBullets', () => {
  it('merges restated bullets by PR set, first occurrence winning', () => {
    const bullets = parseChangelog(fixture('changelog-9.8.md'), '2026.9.8');
    const deduped = dedupeBullets(bullets);
    expect(deduped).toHaveLength(7);
    // the six Highlights win over the Fixes that restate them
    expect(deduped.filter((b) => b.section === 'Highlights')).toHaveLength(6);
  });

  it('matches PR sets regardless of order and never merges bullets without PRs', () => {
    const bullets = parseChangelog(
      [
        '### Highlights',
        '- A (#2, #1)',
        '- No PR here',
        '### Fixes',
        '- A again (#1, #2)',
        '- No PR here',
        '- B (#1)',
      ].join('\n'),
      '2026.1.1'
    );
    expect(dedupeBullets(bullets).map((b) => b.text)).toEqual([
      'A (#2, #1)',
      'No PR here',
      'No PR here',
      'B (#1)',
    ]);
  });
});
