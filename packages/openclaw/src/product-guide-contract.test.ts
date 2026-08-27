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
    expect(guide).toContain('Use the destination that matches the job');
    expect(guide).toContain(
      'Normal replies, scheduled alerts, and status updates belong in the conversation'
    );
    expect(guide).toContain(
      'Tlonbot groups are provisioned with an **Updates** Notebook'
    );
    expect(guide).toContain(
      'A recurring workflow can keep its durable record in that Notebook while delivering new alerts or short summaries to the requesting conversation'
    );
    expect(guide).toContain('do not silently choose among ambiguous groups');
    expect(guide).toContain(
      'Create another Notebook only when the owner explicitly asks'
    );
    expect(guide).toContain('paste it into the current chat');
  });
});
