import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const guide = readFileSync(
  new URL('../skills/tlon-product-guide/SKILL.md', import.meta.url),
  'utf8'
);

describe('Tlon product guide contracts', () => {
  it('distinguishes hosted subscriptions from API-key billing', () => {
    const frontmatter = guide.match(/^---\n([\s\S]*?)\n---/)?.[1];
    expect(frontmatter).toContain(
      "A hosted Tlonbot can use models included with a ChatGPT, Claude or Grok subscription through Tlon's own connection flow"
    );
    expect(frontmatter).toContain(
      'this is not generic API or OpenRouter billing'
    );
    expect(guide).toContain(
      '`Provider subscriptions` covers ChatGPT, Claude and Grok'
    );
    expect(guide).toContain('run `claude setup-token` in Claude Code');
    expect(guide).toContain(
      'A subscription and an API key for the same provider are alternatives'
    );
    expect(guide).toContain(
      "don't substitute generic OpenClaw or OpenRouter billing advice"
    );
  });
});
