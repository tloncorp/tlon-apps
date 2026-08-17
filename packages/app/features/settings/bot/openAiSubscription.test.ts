import { describe, expect, it } from 'vitest';

import {
  canDismissOpenAIAuth,
  copyOpenAIUserCode,
  getLLMAuthDisconnectQueryKeys,
  getLLMAuthProviderStatus,
  getLLMAuthStatusRefetchInterval,
  getLLMAuthSubscriptionModels,
  getOpenAIAuthStatus,
  getOpenAICredentialSwitch,
  getOpenAIDisconnectQueryKeys,
  getOpenAISubscriptionModels,
  getOpenAIVerificationUrl,
  isLLMAuthProviderConnected,
  mergeProviderModels,
  reduceOpenAIAuthState,
} from './openAiSubscription';

const awaitingFlow = {
  id: 'flow-1',
  provider: 'openai' as const,
  status: 'awaiting_browser' as const,
  expiresAt: 5_000,
  userCode: 'ABCD',
  verificationUrl: 'https://auth.openai.com/codex/device',
};

describe('OpenAI subscription auth state', () => {
  it('copies a present user code before showing success feedback', async () => {
    const events: string[] = [];

    expect(
      await copyOpenAIUserCode(
        '92C3-D94VL',
        async () => {
          events.push('copy');
        },
        () => events.push('feedback')
      )
    ).toBe(true);
    expect(events).toEqual(['copy', 'feedback']);
  });

  it('does nothing when no user code is available', async () => {
    const events: string[] = [];

    expect(
      await copyOpenAIUserCode(
        undefined,
        async () => {
          events.push('copy');
        },
        () => events.push('feedback')
      )
    ).toBe(false);
    expect(events).toEqual([]);
  });

  it('allows leaving only interruptible auth phases', () => {
    expect(canDismissOpenAIAuth('idle')).toBe(true);
    expect(canDismissOpenAIAuth('starting')).toBe(true);
    expect(canDismissOpenAIAuth('active')).toBe(true);
    expect(canDismissOpenAIAuth('error')).toBe(true);
    expect(canDismissOpenAIAuth('complete')).toBe(false);
  });

  it('moves a started flow through completion', () => {
    expect(reduceOpenAIAuthState({ phase: 'idle' }, { type: 'start' })).toEqual(
      { phase: 'starting' }
    );

    const active = reduceOpenAIAuthState(
      { phase: 'starting' },
      { type: 'flow', flow: awaitingFlow, now: 1_000 }
    );
    expect(active).toEqual({ phase: 'active', flow: awaitingFlow });
    if (active.phase !== 'active') throw new Error('Expected active flow');

    expect(
      reduceOpenAIAuthState(active, {
        type: 'flow',
        flow: { ...active.flow, status: 'complete' },
        now: 2_000,
      })
    ).toEqual({
      phase: 'complete',
      flow: { ...active.flow, status: 'complete' },
    });
  });

  it('accepts a completed server flow even after its local expiry', () => {
    const completeFlow = { ...awaitingFlow, status: 'complete' as const };

    expect(
      reduceOpenAIAuthState(
        { phase: 'active', flow: awaitingFlow },
        {
          type: 'flow',
          flow: completeFlow,
          now: completeFlow.expiresAt + 1,
        }
      )
    ).toEqual({ phase: 'complete', flow: completeFlow });
  });

  it('retains device-code details across partial pending updates', () => {
    expect(
      reduceOpenAIAuthState(
        { phase: 'active', flow: awaitingFlow },
        {
          type: 'flow',
          flow: {
            id: awaitingFlow.id,
            provider: 'openai',
            status: 'authenticating',
            expiresAt: awaitingFlow.expiresAt,
          },
          now: 2_000,
        }
      )
    ).toEqual({
      phase: 'active',
      flow: {
        ...awaitingFlow,
        status: 'authenticating',
      },
    });
  });

  it('turns an expired active flow into a restartable error', () => {
    expect(
      reduceOpenAIAuthState(
        { phase: 'active', flow: awaitingFlow },
        { type: 'expired', now: awaitingFlow.expiresAt + 1 }
      )
    ).toEqual({
      phase: 'error',
      message: 'This connection attempt expired.',
      restartable: true,
      flow: awaitingFlow,
    });
  });

  it('maps a missing flow to a restartable gateway-loss error', () => {
    const failed = reduceOpenAIAuthState(
      { phase: 'active', flow: awaitingFlow },
      { type: 'failure', message: 'Flow no longer exists.', notFound: true }
    );
    expect(failed).toEqual({
      phase: 'error',
      message: 'This connection attempt expired or the bot restarted.',
      restartable: true,
      flow: awaitingFlow,
    });
    expect(reduceOpenAIAuthState(failed, { type: 'reset' })).toEqual({
      phase: 'idle',
    });
  });
});

describe('OpenAI subscription status and models', () => {
  const status = {
    ts: 1,
    providers: [{ provider: 'openai', status: 'ok' }],
    subscriptionModels: {
      openai: [{ id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' }],
    },
  };

  it('recognizes statuses backed by a usable provider credential', () => {
    expect(isLLMAuthProviderConnected('ok')).toBe(true);
    expect(isLLMAuthProviderConnected('static')).toBe(true);
    expect(isLLMAuthProviderConnected('expiring')).toBe(true);
    expect(isLLMAuthProviderConnected('expired')).toBe(false);
    expect(isLLMAuthProviderConnected('missing')).toBe(false);
  });

  it('refreshes status by the next credential expiry', () => {
    expect(
      getLLMAuthStatusRefetchInterval(
        {
          ts: 1,
          providers: [
            {
              provider: 'openai',
              status: 'expiring',
              expiry: { at: 31_000, remainingMs: 30_000, label: '30s' },
            },
          ],
        },
        1_000
      )
    ).toBe(30_000);
    expect(getLLMAuthStatusRefetchInterval(undefined, 1_000)).toBe(60_000);
  });

  it('selects OpenAI status and subscription models', () => {
    expect(getOpenAIAuthStatus(status)).toEqual({
      provider: 'openai',
      status: 'ok',
    });
    expect(getOpenAISubscriptionModels(status)).toEqual([
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
    ]);
  });

  it('selects xAI status and subscription models', () => {
    const xaiStatus = {
      ts: 1,
      providers: [{ provider: 'xai', status: 'ok' }],
      subscriptionModels: {
        xai: [{ id: 'grok-4.3', name: 'Grok 4.3' }],
      },
    };
    expect(getLLMAuthProviderStatus(xaiStatus, 'xai')).toEqual({
      provider: 'xai',
      status: 'ok',
    });
    expect(getLLMAuthSubscriptionModels(xaiStatus, 'xai')).toEqual([
      { id: 'grok-4.3', name: 'Grok 4.3' },
    ]);
    expect(getLLMAuthDisconnectQueryKeys('zod', 'user-1', 'xai')).toEqual([
      ['tlonbot', 'llm-auth-status', 'zod'],
      ['tlonbot', 'provider-config', 'user-1'],
      ['tlonbot', 'provider-models', 'user-1', 'xai'],
    ]);
  });

  it('selects Anthropic status and subscription models', () => {
    const anthropicStatus = {
      ts: 1,
      providers: [{ provider: 'anthropic', status: 'ok' }],
      subscriptionModels: {
        anthropic: [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }],
      },
    };
    expect(getLLMAuthProviderStatus(anthropicStatus, 'anthropic')).toEqual({
      provider: 'anthropic',
      status: 'ok',
    });
    expect(getLLMAuthSubscriptionModels(anthropicStatus, 'anthropic')).toEqual([
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
    ]);
  });

  it('deduplicates subscription and API-key models by id', () => {
    expect(
      mergeProviderModels(
        [{ id: 'gpt-5', name: 'GPT-5' }],
        [{ id: 'gpt-5' }, { id: 'gpt-4.1' }]
      )
    ).toEqual([{ id: 'gpt-5', name: 'GPT-5' }, { id: 'gpt-4.1' }]);
  });

  it('accepts only the exact HTTPS verification URL returned by the bot', () => {
    expect(
      getOpenAIVerificationUrl('https://auth.openai.com/codex/device')
    ).toBe('https://auth.openai.com/codex/device');
    expect(
      getOpenAIVerificationUrl('http://auth.openai.com/codex/device')
    ).toBeNull();
    expect(getOpenAIVerificationUrl('not a URL')).toBeNull();
    expect(getOpenAIVerificationUrl(undefined)).toBeNull();
  });

  it('requires the existing provider credential mode to be removed when switching', () => {
    expect(
      getOpenAICredentialSwitch(
        { hasApiKey: true, subscriptionConnected: false },
        'subscription'
      )
    ).toEqual({ next: 'subscription', remove: 'api-key' });
    expect(
      getOpenAICredentialSwitch(
        { hasApiKey: false, subscriptionConnected: true },
        'api-key'
      )
    ).toEqual({ next: 'api-key', remove: 'subscription' });
    expect(
      getOpenAICredentialSwitch(
        { hasApiKey: true, subscriptionConnected: false },
        'api-key'
      )
    ).toEqual({ next: 'api-key', remove: null });
  });

  it('refetches server-owned status and configuration after disconnect', () => {
    expect(getOpenAIDisconnectQueryKeys('zod', 'user-1')).toEqual([
      ['tlonbot', 'llm-auth-status', 'zod'],
      ['tlonbot', 'provider-config', 'user-1'],
      ['tlonbot', 'provider-models', 'user-1', 'openai'],
    ]);
  });
});
