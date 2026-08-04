import { describe, expect, it } from 'vitest';

import { buildBotCredentialOptions } from './botProviderOptions';

const emptyConfig = { keys: {}, models: [], defaultKeys: {} };

describe('bot credential choices', () => {
  it('offers distinct sibling OpenAI choices for ready normal signup', () => {
    const openAIOptions = buildBotCredentialOptions({
      providerConfig: emptyConfig,
      botReady: true,
      mode: 'signup',
    }).filter((option) => option.provider === 'openai');

    expect(openAIOptions).toEqual([
      expect.objectContaining({
        id: 'openai:subscription',
        credentialMode: 'subscription',
        requiresKey: false,
      }),
      expect.objectContaining({
        id: 'openai:api-key',
        credentialMode: 'api-key',
        requiresKey: true,
      }),
    ]);
    expect(openAIOptions[0]?.recommendationLabel).toBe('Recommended');
    expect(openAIOptions[1]?.recommendationLabel).toBeUndefined();
  });

  it('never offers subscription auth during revival', () => {
    expect(
      buildBotCredentialOptions({
        providerConfig: emptyConfig,
        botReady: true,
        mode: 'tlonbotRevival',
      }).some((option) => option.credentialMode === 'subscription')
    ).toBe(false);
  });

  it('omits subscription auth while the normal-signup bot is unready', () => {
    expect(
      buildBotCredentialOptions({
        providerConfig: emptyConfig,
        botReady: false,
        mode: 'signup',
      }).some((option) => option.credentialMode === 'subscription')
    ).toBe(false);
  });

  it('orders included access before OpenAI alternatives and other API keys', () => {
    const options = buildBotCredentialOptions({
      providerConfig: {
        ...emptyConfig,
        defaultKeys: { basic: { key: 'included' } },
      },
      botReady: true,
      mode: 'signup',
    });
    expect(options.map((option) => option.id)).toEqual([
      'basic:included',
      'openai:subscription',
      'openai:api-key',
      'anthropic:api-key',
      'openrouter:api-key',
    ]);
    expect(options[0]?.label).toBe('GPT-5.6 Luna');
  });
});
