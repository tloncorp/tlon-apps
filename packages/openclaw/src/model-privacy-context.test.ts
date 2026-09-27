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
    ).toContain('zero data retention is on');
  });

  it('says it is off for a routed model without the flag', () => {
    expect(
      modelPrivacyNote(
        withZdr('openrouter/anthropic/claude-sonnet-5'),
        'openrouter',
        'openai/gpt-6-luna'
      )
    ).toContain('zero data retention is off');
    expect(modelPrivacyNote({}, 'openrouter', 'openai/gpt-6-luna')).toContain(
      'is off'
    );
  });

  it('says a direct provider runs under its own policy', () => {
    const note = modelPrivacyNote({}, 'anthropic', 'claude-sonnet-5');
    expect(note).toContain("under that provider's own data policy");
    expect(note).not.toContain('is on');
  });

  it('says nothing when the run has no model yet', () => {
    expect(modelPrivacyNote({}, undefined, undefined)).toBeUndefined();
  });
});
