import { describe, expect, it } from 'vitest';

import { resolveInitialProviderModel } from './providerModelDefaults';

describe('resolveInitialProviderModel', () => {
  it('selects GPT-5.6 Luna when a custom OpenAI catalog includes it', () => {
    expect(
      resolveInitialProviderModel(
        'openai',
        [{ id: 'gpt-5.6-luna' }, { id: 'gpt-5.5' }],
        ''
      )
    ).toBe('gpt-5.6-luna');
  });

  it('preserves an existing selection that remains available', () => {
    expect(
      resolveInitialProviderModel(
        'openai',
        [{ id: 'gpt-5.6-luna' }, { id: 'gpt-5.5' }],
        'gpt-5.5'
      )
    ).toBe('gpt-5.5');
  });

  it('does not default other providers to an OpenAI model', () => {
    expect(
      resolveInitialProviderModel('openrouter', [{ id: 'gpt-5.6-luna' }], '')
    ).toBe('');
  });

  it('leaves OpenAI unselected when Luna is unavailable', () => {
    expect(resolveInitialProviderModel('openai', [{ id: 'gpt-5.5' }], '')).toBe(
      ''
    );
  });
});
