import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

// The guide is a router (SKILL.md) plus the product files it points to; the
// contracts below hold across all of them.
const guideDir = new URL('../skills/tlon-product-guide/', import.meta.url);
const guide = [
  'SKILL.md',
  'product/tlon-messenger.md',
  'product/tlonbot.md',
  'product/privacy-and-hosting.md',
  'product/ideas-faq-and-tlon.md',
]
  .map((file) => readFileSync(new URL(file, guideDir), 'utf8'))
  .join('\n');

describe('Tlon product guide contracts', () => {
  // On a model with under 100K tokens of context, OpenClaw caps a tool result
  // at 16,000 characters. It refuses a SKILL.md over that outright, and pages
  // any other file, so a longer index would take a second read to see whole.
  it.each(['SKILL.md', 'references/index.md'])(
    'keeps %s within one read on a small model',
    (file) => {
      const text = readFileSync(new URL(file, guideDir), 'utf8');
      expect(text.length).toBeLessThanOrEqual(16_000);
    }
  );

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

  it('answers connected service questions from the live list', () => {
    expect(guide).toContain(
      'A hosted bot can look it up with `tlon_connectable_services`: answer from that list by name.'
    );
    expect(guide).toContain('Never say a service is probably or maybe there.');
    expect(guide).toContain("but can't read their inbox");
  });

  it('describes the Just me filter as conditional', () => {
    expect(guide).toContain(
      '`Just me` only appears when you have a workspace like that'
    );
  });
});
