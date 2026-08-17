import type {
  TlawnLLMAuthFlow,
  TlawnLLMAuthStatus,
  TlawnSubscriptionModel,
} from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenAIAuthController } from './openAiSubscriptionController';

const awaitingFlow: TlawnLLMAuthFlow = {
  id: 'flow-1',
  provider: 'openai',
  status: 'awaiting_browser',
  expiresAt: 10_000,
  userCode: 'ABCD',
  verificationUrl: 'https://auth.openai.com/codex/device',
};

const connectedStatus: TlawnLLMAuthStatus = {
  ts: 2_000,
  providers: [{ provider: 'openai', status: 'ok' }],
  subscriptionModels: {
    openai: [{ id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' }],
  },
};

function makeController({
  flow = awaitingFlow,
  status = connectedStatus,
  poll = async () => ({
    flow: { ...flow, status: 'complete' as const },
  }),
  complete = async () => ({
    flow: { ...flow, status: 'complete' as const },
  }),
  onComplete = () => {},
}: {
  flow?: TlawnLLMAuthFlow;
  status?: TlawnLLMAuthStatus;
  poll?: (flowId: string) => Promise<{ flow: TlawnLLMAuthFlow }>;
  complete?: (
    flowId: string,
    token: string
  ) => Promise<{ flow: TlawnLLMAuthFlow }>;
  onComplete?: () => void | Promise<void>;
} = {}) {
  let completedModels: TlawnSubscriptionModel[] | null = null;
  const controller = new OpenAIAuthController({
    provider: flow.provider,
    now: () => Date.now(),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancel: (timer) => clearTimeout(timer),
    start: async () => ({ flow }),
    complete,
    poll,
    loadStatus: async () => status,
    onComplete: async (models) => {
      completedModels = models;
      await onComplete();
    },
  });
  return { controller, getCompletedModels: () => completedModels };
}

describe('OpenAIAuthController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts, polls, reports subscription models, and resets', async () => {
    const { controller, getCompletedModels } = makeController();

    await controller.start();
    expect(controller.getState()).toEqual({
      phase: 'active',
      flow: awaitingFlow,
    });

    await vi.advanceTimersByTimeAsync(1_500);

    expect(controller.getState()).toEqual({ phase: 'idle' });
    expect(getCompletedModels()).toEqual([
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
    ]);
  });

  it('loads models for the authenticated xAI provider', async () => {
    const xaiFlow: TlawnLLMAuthFlow = {
      ...awaitingFlow,
      provider: 'xai',
      verificationUrl: 'https://accounts.x.ai/authorize',
    };
    const xaiStatus: TlawnLLMAuthStatus = {
      ts: 2_000,
      providers: [{ provider: 'xai', status: 'ok' }],
      subscriptionModels: {
        xai: [{ id: 'grok-4.3', name: 'Grok 4.3' }],
      },
    };
    const { controller, getCompletedModels } = makeController({
      flow: xaiFlow,
      status: xaiStatus,
    });

    await controller.start();
    await vi.advanceTimersByTimeAsync(1_500);

    expect(getCompletedModels()).toEqual([
      { id: 'grok-4.3', name: 'Grok 4.3' },
    ]);
  });

  it('completes an Anthropic setup-token flow and loads its models', async () => {
    const anthropicFlow: TlawnLLMAuthFlow = {
      id: 'flow-anthropic',
      provider: 'anthropic',
      status: 'awaiting_token',
      expiresAt: 10_000,
    };
    const anthropicStatus: TlawnLLMAuthStatus = {
      ts: 2_000,
      providers: [{ provider: 'anthropic', status: 'ok' }],
      subscriptionModels: {
        anthropic: [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }],
      },
    };
    const complete = vi.fn(async () => ({
      flow: { ...anthropicFlow, status: 'complete' as const },
    }));
    const { controller, getCompletedModels } = makeController({
      flow: anthropicFlow,
      status: anthropicStatus,
      complete,
    });

    await controller.start();
    await expect(controller.complete(' setup-token ')).resolves.toBe(true);

    expect(complete).toHaveBeenCalledWith('flow-anthropic', 'setup-token');
    expect(controller.getState()).toEqual({ phase: 'idle' });
    expect(getCompletedModels()).toEqual([
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
    ]);
  });

  it('keeps the Anthropic token form active after a rejected token', async () => {
    const anthropicFlow: TlawnLLMAuthFlow = {
      id: 'flow-anthropic',
      provider: 'anthropic',
      status: 'awaiting_token',
      expiresAt: 10_000,
    };
    const poll = vi.fn(async () => ({ flow: anthropicFlow }));
    const { controller } = makeController({
      flow: anthropicFlow,
      complete: async () => {
        throw new Error('Invalid setup token.');
      },
      poll,
    });

    await controller.start();
    await expect(controller.complete('bad-token')).resolves.toBe(false);

    expect(controller.getState()).toEqual({
      phase: 'active',
      flow: anthropicFlow,
      error: 'Invalid setup token.',
    });

    await vi.advanceTimersByTimeAsync(1_500);

    expect(poll).toHaveBeenCalledWith('flow-anthropic');
    expect(controller.getState()).toEqual({
      phase: 'active',
      flow: anthropicFlow,
      error: 'Invalid setup token.',
    });
  });

  it('observes flow expiry after an Anthropic token is rejected', async () => {
    const anthropicFlow: TlawnLLMAuthFlow = {
      id: 'flow-anthropic',
      provider: 'anthropic',
      status: 'awaiting_token',
      expiresAt: 4_000,
    };
    const { controller } = makeController({
      flow: anthropicFlow,
      complete: async () => {
        throw new Error('Invalid setup token.');
      },
      poll: async () => ({ flow: anthropicFlow }),
    });

    await controller.start();
    await controller.complete('bad-token');
    await vi.advanceTimersByTimeAsync(3_000);

    expect(controller.getState()).toMatchObject({
      phase: 'error',
      message: 'This connection attempt expired.',
      restartable: true,
    });
  });

  it('stays complete until completion handling finishes', async () => {
    let finishCompletion: () => void = () => {};
    const completion = new Promise<void>((resolve) => {
      finishCompletion = resolve;
    });
    const { controller } = makeController({
      flow: { ...awaitingFlow, status: 'complete' },
      onComplete: () => completion,
    });

    const start = controller.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getState().phase).toBe('complete');

    finishCompletion();
    await start;

    expect(controller.getState().phase).toBe('idle');
  });

  it('pauses scheduled polling and polls immediately on resume', async () => {
    const { controller } = makeController();
    await controller.start();

    controller.pause();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(controller.getState().phase).toBe('active');

    await controller.resume();
    expect(controller.getState().phase).toBe('idle');
  });

  it('maps a missing flow to a restartable gateway-loss error', async () => {
    const { controller } = makeController({
      poll: async () => {
        throw { details: { status: 404 } };
      },
    });
    await controller.start();

    await vi.advanceTimersByTimeAsync(1_500);

    expect(controller.getState()).toMatchObject({
      phase: 'error',
      message: 'This connection attempt expired or the bot restarted.',
      restartable: true,
    });
  });

  it('retries a transient polling failure without replacing the flow', async () => {
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error('Temporary gateway failure.'))
      .mockResolvedValueOnce({
        flow: { ...awaitingFlow, status: 'complete' as const },
      });
    const { controller } = makeController({ poll });
    await controller.start();

    await vi.advanceTimersByTimeAsync(1_500);
    expect(controller.getState()).toEqual({
      phase: 'active',
      flow: awaitingFlow,
    });

    await vi.advanceTimersByTimeAsync(1_500);
    expect(controller.getState()).toEqual({ phase: 'idle' });
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('polls once at the deadline before expiring a pending flow', async () => {
    let pollCount = 0;
    const expiringFlow = { ...awaitingFlow, expiresAt: 1_100 };
    const { controller } = makeController({
      flow: expiringFlow,
      poll: async () => {
        pollCount += 1;
        return { flow: expiringFlow };
      },
    });
    await controller.start();

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getState()).toMatchObject({
      phase: 'error',
      message: 'This connection attempt expired.',
      restartable: true,
    });
    expect(pollCount).toBe(1);
  });

  it('accepts completion returned by the final deadline poll', async () => {
    const expiringFlow = { ...awaitingFlow, expiresAt: 1_100 };
    const { controller, getCompletedModels } = makeController({
      flow: expiringFlow,
      poll: async () => ({
        flow: { ...expiringFlow, status: 'complete' },
      }),
    });
    await controller.start();

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getState()).toEqual({ phase: 'idle' });
    expect(getCompletedModels()).toEqual([
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
    ]);
  });

  it('shows a retryable error instead of completing without models', async () => {
    const onComplete = vi.fn();
    const { controller } = makeController({
      flow: { ...awaitingFlow, status: 'complete' },
      status: { ...connectedStatus, subscriptionModels: {} },
      onComplete,
    });

    await controller.start();

    expect(controller.getState()).toMatchObject({
      phase: 'error',
      restartable: true,
      message: expect.stringContaining(
        'No subscription models are available yet.'
      ),
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('retries post-auth completion without starting a new flow', async () => {
    const onComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not finish setup.'))
      .mockResolvedValueOnce(undefined);
    const { controller } = makeController({
      flow: { ...awaitingFlow, status: 'complete' },
      onComplete,
    });

    await controller.start();
    expect(controller.getState()).toMatchObject({
      phase: 'error',
      flow: { status: 'complete' },
    });

    await controller.retry();

    expect(controller.getState()).toEqual({ phase: 'idle' });
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('does not publish scheduled work after disposal', async () => {
    const { controller } = makeController();
    await controller.start();

    controller.dispose();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(controller.getState().phase).toBe('active');
  });
});
