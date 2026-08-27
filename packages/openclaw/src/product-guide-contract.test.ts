import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const guide = readFileSync(
  new URL('../skills/tlon-product-guide/SKILL.md', import.meta.url),
  'utf8'
);
describe('Tlon product guide contracts', () => {
  it('does not map backend notes paths to an invented global screen', () => {
    const frontmatter = guide.match(/^---\n([\s\S]*?)\n---/)?.[1];
    expect(frontmatter).toContain(
      'difference between backend notes paths and group-backed Notebook channels'
    );
    expect(guide).toContain(
      'There is no global `Notes` or `Notebooks` dashboard in Tlon Messenger'
    );
    expect(guide).toContain('Notebook channel inside a group');
    expect(guide).toContain(
      'Normal replies, recurring alerts, reports, and other generated material belong in the conversation'
    );
    expect(guide).toContain(
      'Do not infer that material belongs in a Notebook merely because it is long-lived or document-like'
    );
    expect(guide).toContain(
      'When the owner explicitly asks to save material in a Notebook'
    );
    expect(guide).toContain(
      'Create another Notebook only when the owner explicitly asks'
    );
    expect(guide).toContain('paste it into the current chat');
  });
});
