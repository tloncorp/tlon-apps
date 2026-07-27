import { describe, expect, it } from 'vitest';

import {
  extractOpenAICodexModels,
  extractSubscriptionModels,
  isManagedConfigLockPermissionError,
  parseOpenAIVerificationMessage,
} from './provider-auth-routes.js';

describe('extractSubscriptionModels', () => {
  it('keeps available subscription-compatible models separate by provider', () => {
    expect(
      extractSubscriptionModels({
        models: [
          {
            provider: 'openai',
            id: 'gpt-5.6-luna',
            name: 'GPT-5.6 Luna',
            api: 'openai-chatgpt-responses',
            available: true,
          },
          {
            provider: 'openai',
            id: 'gpt-5.6',
            name: 'GPT-5.6',
            api: 'openai-responses',
            available: true,
          },
          {
            provider: 'openai',
            id: 'gpt-5.6-luna',
            name: 'GPT-5.6 Luna API',
            api: 'openai-responses',
            available: true,
          },
          {
            provider: 'anthropic',
            id: 'claude-sonnet-5',
            name: 'Claude Sonnet 5',
            api: 'anthropic-messages',
            available: true,
          },
          {
            provider: 'anthropic',
            id: 'claude-opus-4-8',
            name: 'Claude Opus 4.8',
            api: 'anthropic-messages',
            available: false,
          },
        ],
      })
    ).toEqual({
      openai: [{ id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' }],
      anthropic: [
        { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
        { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
      ],
    });
  });

  it('accepts the normalized models.list key projection', () => {
    expect(
      extractSubscriptionModels({
        models: [
          {
            key: 'openai/gpt-5.6-luna',
            name: 'GPT-5.6 Luna',
            available: true,
          },
          {
            key: 'openai/gpt-5.3-chat-latest',
            name: 'GPT-5.3 Chat',
            available: true,
          },
          {
            key: 'anthropic/claude-sonnet-5',
            name: 'Claude Sonnet 5',
          },
        ],
      })
    ).toEqual({
      openai: [{ id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' }],
      anthropic: [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }],
    });
  });

  it('deduplicates model ids and ignores malformed catalog rows', () => {
    expect(
      extractSubscriptionModels({
        models: [
          {
            provider: 'openai',
            id: 'gpt-5.6-luna',
            api: 'openai-chatgpt-responses',
            available: true,
          },
          {
            provider: 'openai',
            id: 'gpt-5.6-luna',
            name: 'Duplicate',
            api: 'openai-chatgpt-responses',
            available: true,
          },
          null,
          { provider: 'anthropic', id: '', available: true },
        ],
      })
    ).toEqual({
      openai: [{ id: 'gpt-5.6-luna' }],
      anthropic: [],
    });
  });
});

describe('extractOpenAICodexModels', () => {
  it('returns only models exposed in the account picker', () => {
    expect(
      extractOpenAICodexModels({
        models: [
          {
            slug: 'gpt-5.6-luna',
            display_name: 'GPT-5.6 Luna',
            visibility: 'list',
            show_in_picker: true,
          },
          {
            id: 'gpt-5.6-sol',
            name: 'GPT-5.6 Sol',
            visibility: 'list',
          },
          {
            slug: 'hidden-model',
            visibility: 'hide',
          },
          {
            slug: 'disabled-model',
            visibility: 'list',
            show_in_picker: false,
          },
        ],
      })
    ).toEqual([
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
    ]);
  });

  it('deduplicates model ids and ignores malformed rows', () => {
    expect(
      extractOpenAICodexModels({
        models: [
          { slug: 'gpt-5.6-luna' },
          { id: 'gpt-5.6-luna', name: 'Duplicate' },
          { slug: '' },
          null,
        ],
      })
    ).toEqual([{ id: 'gpt-5.6-luna' }]);
  });
});

describe('isManagedConfigLockPermissionError', () => {
  it('recognizes the root-managed config lock failure', () => {
    expect(
      isManagedConfigLockPermissionError(
        new Error(
          "EACCES: permission denied, open '/opt/openclaw-managed/moon/openclaw.json.lock'"
        )
      )
    ).toBe(true);
  });

  it.each([
    "EACCES: permission denied, open '/pier/moon/auth-profiles.json.lock'",
    "ENOENT: no such file, open '/opt/openclaw-managed/moon/openclaw.json.lock'",
    'OpenAI device authorization expired',
  ])('does not swallow a different auth failure: %s', (message) => {
    expect(isManagedConfigLockPermissionError(new Error(message))).toBe(false);
  });
});

describe('parseOpenAIVerificationMessage', () => {
  it('extracts the OpenAI device URL and one-time code', () => {
    expect(
      parseOpenAIVerificationMessage(
        [
          'Open this URL in your browser.',
          'URL: https://auth.openai.com/codex/device',
          'Code: ABCD-EFGH',
        ].join('\n')
      )
    ).toEqual({
      verificationUrl: 'https://auth.openai.com/codex/device',
      userCode: 'ABCD-EFGH',
    });
  });

  it.each([
    'URL: http://auth.openai.com/codex/device\nCode: ABCD-EFGH',
    'URL: https://evil.example/codex/device\nCode: ABCD-EFGH',
    'URL: https://auth.openai.com.evil.example/codex/device\nCode: ABCD-EFGH',
    'URL: https://auth.openai.com/codex/other\nCode: ABCD-EFGH',
    'URL: https://auth.openai.com/codex/device',
  ])('rejects an invalid or incomplete handoff: %s', (message) => {
    expect(parseOpenAIVerificationMessage(message)).toBeNull();
  });
});
