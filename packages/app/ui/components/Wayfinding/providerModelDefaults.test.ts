import { describe, expect, it } from 'vitest';

import {
  initializeOpenAISubscriptionModels,
  initializeSubscriptionModels,
  resolveInitialProviderModel,
} from './providerModelDefaults';

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

  it('selects Grok 4.3 for xAI when available', () => {
    expect(
      resolveInitialProviderModel(
        'xai',
        [{ id: 'grok-4.3' }, { id: 'grok-4.2' }],
        ''
      )
    ).toBe('grok-4.3');
  });

  it('selects Claude Sonnet 5 for Anthropic when available', () => {
    expect(
      resolveInitialProviderModel(
        'anthropic',
        [{ id: 'claude-sonnet-5' }, { id: 'claude-opus-4-6' }],
        ''
      )
    ).toBe('claude-sonnet-5');
  });

  it('leaves OpenAI unselected when Luna is unavailable', () => {
    expect(resolveInitialProviderModel('openai', [{ id: 'gpt-5.5' }], '')).toBe(
      ''
    );
  });
});

describe('initializeOpenAISubscriptionModels', () => {
  it('selects GPT-5.6 Luna from the subscription catalog', () => {
    expect(
      initializeOpenAISubscriptionModels(
        [{ id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' }, { id: 'gpt-5.5' }],
        ''
      )
    ).toEqual({
      providerModels: [
        { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
        { id: 'gpt-5.5' },
      ],
      primaryModel: 'gpt-5.6-luna',
    });
  });

  it('leaves the subscription model unselected when Luna is unavailable', () => {
    expect(
      initializeOpenAISubscriptionModels([{ id: 'gpt-5.5' }], '').primaryModel
    ).toBe('');
  });
});

describe('initializeSubscriptionModels', () => {
  it('initializes Anthropic subscription models with Claude Sonnet 5 selected', () => {
    expect(
      initializeSubscriptionModels(
        'anthropic',
        [
          { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
          { id: 'claude-opus-4-6' },
        ],
        ''
      )
    ).toEqual({
      providerModels: [
        { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
        { id: 'claude-opus-4-6' },
      ],
      primaryModel: 'claude-sonnet-5',
    });
  });

  it('initializes xAI subscription models with Grok 4.3 selected', () => {
    expect(
      initializeSubscriptionModels(
        'xai',
        [{ id: 'grok-4.3', name: 'Grok 4.3' }, { id: 'grok-4.2' }],
        ''
      )
    ).toEqual({
      providerModels: [
        { id: 'grok-4.3', name: 'Grok 4.3' },
        { id: 'grok-4.2' },
      ],
      primaryModel: 'grok-4.3',
    });
  });
});
