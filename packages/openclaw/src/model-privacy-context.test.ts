import { describe, expect, it } from 'vitest';

import { modelPrivacyNote } from './model-privacy-context.js';

const withZdr = (ref: string) => ({
  agents: {
    defaults: {
      models: {
        [ref]: { params: { provider: { zdr: true, data_collection: 'deny' } } },
      },
    },
  },
});

describe('modelPrivacyNote', () => {
  it('says zero data retention is on when hosting routed this model that way', () => {
    expect(
      modelPrivacyNote(
        withZdr('openrouter/openai/gpt-6-luna'),
        'openrouter',
        'openai/gpt-6-luna'
      )
    ).toContain('Zero data retention is on');
  });

  it('says it is off for a routed model without the flag', () => {
    expect(
      modelPrivacyNote(
        withZdr('openrouter/anthropic/claude-sonnet-5'),
        'openrouter',
        'openai/gpt-6-luna'
      )
    ).toContain('Zero data retention is off');
    expect(modelPrivacyNote({}, 'openrouter', 'openai/gpt-6-luna')).toContain(
      'is off'
    );
  });

  it('names the model and how it is reached, not OpenClaw', () => {
    const routed = modelPrivacyNote(
      withZdr('openrouter/openai/gpt-6-luna'),
      'openrouter',
      'openai/gpt-6-luna'
    );
    expect(routed).toContain(
      "you're running openai/gpt-6-luna, routed through OpenRouter"
    );
    expect(routed).toContain('not a model service');
    expect(modelPrivacyNote({}, 'anthropic', 'claude-sonnet-5')).toContain(
      "you're running claude-sonnet-5, with requests sent to anthropic"
    );
  });

  it('treats running without it as a choice, not a fault to fix', () => {
    const note = modelPrivacyNote({}, 'openrouter', 'x-ai/grok-4.6');
    expect(note).toContain("can be the owner's choice");
    expect(note).not.toContain('turn it on');
  });

  it('says a direct provider runs under its own policy', () => {
    const note = modelPrivacyNote({}, 'anthropic', 'claude-sonnet-5');
    expect(note).toContain("under that provider's own data policy");
    expect(note).not.toContain('is on');
  });

  it("points to the product guide for Tlon's side", () => {
    for (const note of [
      modelPrivacyNote(
        withZdr('openrouter/openai/gpt-6-luna'),
        'openrouter',
        'openai/gpt-6-luna'
      ),
      modelPrivacyNote({}, 'openrouter', 'openai/gpt-6-luna'),
      modelPrivacyNote({}, 'anthropic', 'claude-sonnet-5'),
    ]) {
      expect(note).toContain('tlon-product-guide privacy page');
    }
  });

  it('says nothing when the run has no model yet', () => {
    expect(modelPrivacyNote({}, undefined, undefined)).toBeUndefined();
  });
});
