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
  poll = async () => ({
    flow: { ...flow, status: 'complete' as const },
  }),
  onComplete = () => {},
}: {
  flow?: TlawnLLMAuthFlow;
  poll?: (flowId: string) => Promise<{ flow: TlawnLLMAuthFlow }>;
  onComplete?: () => void | Promise<void>;
} = {}) {
  let completedModels: TlawnSubscriptionModel[] | null = null;
  const controller = new OpenAIAuthController({
    now: () => Date.now(),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancel: (timer) => clearTimeout(timer),
    start: async () => ({ flow }),
    poll,
    loadStatus: async () => connectedStatus,
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

  it('expires locally without making another provider-auth request', async () => {
    let pollCount = 0;
    const { controller } = makeController({
      flow: { ...awaitingFlow, expiresAt: 1_100 },
      poll: async () => {
        pollCount += 1;
        return { flow: awaitingFlow };
      },
    });
    await controller.start();

    await vi.advanceTimersByTimeAsync(100);

    expect(controller.getState()).toMatchObject({
      phase: 'error',
      message: 'This connection attempt expired.',
      restartable: true,
    });
    expect(pollCount).toBe(0);
  });

  it('does not publish scheduled work after disposal', async () => {
    const { controller } = makeController();
    await controller.start();

    controller.dispose();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(controller.getState().phase).toBe('active');
  });
});
