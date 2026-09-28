import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const guide = readFileSync(
  new URL('../skills/tlon-product-guide/SKILL.md', import.meta.url),
  'utf8'
);

describe('Tlon product guide contracts', () => {
  it('distinguishes the hosted ChatGPT subscription flow from API-key billing', () => {
    const frontmatter = guide.match(/^---\n([\s\S]*?)\n---/)?.[1];
    expect(frontmatter).toContain(
      "A hosted Tlonbot can use models included with a ChatGPT subscription through Tlon's first-class sign-in flow"
    );
    expect(frontmatter).toContain(
      'this is not generic API or OpenRouter billing'
    );
    expect(guide).toContain('`Bot Settings` → `ChatGPT subscription`');
    expect(guide).toContain(
      'chooses one of the models included with that subscription for Tlonbot'
    );
    expect(guide).toContain(
      'ChatGPT subscription access and an OpenAI API key are alternatives'
    );
    expect(guide).toContain(
      "don't substitute generic OpenClaw or OpenRouter billing advice"
    );
  });
});
