import type {
  TlawnLLMAuthFlow,
  TlawnLLMAuthFlowResponse,
  TlawnLLMAuthProvider,
  TlawnLLMAuthStatus,
  TlawnSubscriptionModel,
} from '@tloncorp/api';

import {
  OpenAIAuthState,
  getLLMAuthSubscriptionModels,
  reduceOpenAIAuthState,
} from './openAiSubscription';

const POLL_INTERVAL_MS = 1_500;

type TimerHandle = ReturnType<typeof setTimeout>;

type OpenAIAuthControllerDeps = {
  provider: TlawnLLMAuthProvider;
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => TimerHandle;
  cancel: (timer: TimerHandle) => void;
  start: () => Promise<TlawnLLMAuthFlowResponse>;
  complete: (
    flowId: string,
    token: string
  ) => Promise<TlawnLLMAuthFlowResponse>;
  poll: (flowId: string) => Promise<TlawnLLMAuthFlowResponse>;
  loadStatus: () => Promise<TlawnLLMAuthStatus>;
  onComplete: (
    models: TlawnSubscriptionModel[],
    status: TlawnLLMAuthStatus
  ) => void | Promise<void>;
};

function getErrorMessage(
  error: unknown,
  provider: TlawnLLMAuthProvider
): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  const subscription =
    provider === 'xai'
      ? 'Grok subscription'
      : provider === 'anthropic'
        ? 'Claude subscription'
        : 'ChatGPT subscription';
  return `Could not connect your ${subscription}.`;
}

function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'details' in error &&
      error.details &&
      typeof error.details === 'object' &&
      'status' in error.details &&
      error.details.status === 404
  );
}

export class OpenAIAuthController {
  private state: OpenAIAuthState = { phase: 'idle' };
  private timer: TimerHandle | null = null;
  private listeners = new Set<(state: OpenAIAuthState) => void>();
  private paused = false;
  private disposed = false;
  private completionHandled = false;
  private generation = 0;

  constructor(private deps: OpenAIAuthControllerDeps) {}

  getState(): OpenAIAuthState {
    return this.state;
  }

  subscribe(listener: (state: OpenAIAuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    this.cancelTimer();
    this.completionHandled = false;
    const generation = ++this.generation;
    this.transition({ type: 'start' });
    try {
      const response = await this.deps.start();
      if (!this.canPublish(generation)) return;
      await this.acceptFlow(response.flow, generation);
    } catch (error) {
      if (!this.canPublish(generation)) return;
      this.transition({
        type: 'failure',
        message: getErrorMessage(error, this.deps.provider),
        notFound: isNotFound(error),
      });
    }
  }

  async retry(): Promise<void> {
    if (
      this.state.phase === 'error' &&
      this.state.flow?.status === 'complete'
    ) {
      const flow = this.state.flow;
      this.cancelTimer();
      this.completionHandled = false;
      const generation = ++this.generation;
      await this.acceptFlow(flow, generation);
      return;
    }
    await this.start();
  }

  async complete(token: string): Promise<boolean> {
    if (
      this.state.phase !== 'active' ||
      this.state.flow.provider !== 'anthropic' ||
      this.state.flow.status !== 'awaiting_token'
    ) {
      return false;
    }
    const trimmedToken = token.trim();
    if (!trimmedToken) return false;

    this.cancelTimer();
    const generation = this.generation;
    const flow = this.state.flow;
    try {
      const response = await this.deps.complete(flow.id, trimmedToken);
      if (!this.canPublish(generation)) return false;
      await this.acceptFlow(response.flow, generation);
      return true;
    } catch (error) {
      if (!this.canPublish(generation)) return false;
      this.transition({
        type: 'tokenFailure',
        message: getErrorMessage(error, this.deps.provider),
      });
      this.schedulePoll();
      return false;
    }
  }

  pause(): void {
    this.paused = true;
    this.cancelTimer();
  }

  async resume(): Promise<void> {
    if (this.disposed) return;
    this.paused = false;
    if (this.state.phase === 'active') {
      await this.pollNow();
    }
  }

  reset(): void {
    this.cancelTimer();
    this.generation += 1;
    this.completionHandled = false;
    this.transition({ type: 'reset' });
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    this.cancelTimer();
    this.listeners.clear();
  }

  private canPublish(generation: number): boolean {
    return !this.disposed && generation === this.generation;
  }

  private transition(event: Parameters<typeof reduceOpenAIAuthState>[1]) {
    if (this.disposed) return;
    this.state = reduceOpenAIAuthState(this.state, event);
    this.listeners.forEach((listener) => listener(this.state));
  }

  private async acceptFlow(
    flow: TlawnLLMAuthFlow,
    generation: number
  ): Promise<void> {
    this.transition({ type: 'flow', flow, now: this.deps.now() });
    if (!this.canPublish(generation)) return;

    if (this.state.phase === 'active') {
      this.schedulePoll();
      return;
    }

    if (this.state.phase !== 'complete' || this.completionHandled) return;
    this.completionHandled = true;
    this.cancelTimer();
    try {
      const status = await this.deps.loadStatus();
      if (!this.canPublish(generation)) return;
      const models = getLLMAuthSubscriptionModels(status, this.deps.provider);
      if (models.length === 0) {
        throw new Error('No subscription models are available yet.');
      }
      await this.deps.onComplete(models, status);
      if (!this.canPublish(generation)) return;
      this.reset();
    } catch (error) {
      if (!this.canPublish(generation)) return;
      this.transition({
        type: 'failure',
        message: `Subscription connected, but setup could not be finished: ${getErrorMessage(error, this.deps.provider)}`,
      });
    }
  }

  private schedulePoll(): void {
    if (this.disposed || this.paused || this.state.phase !== 'active') {
      return;
    }
    this.cancelTimer();
    const remainingMs = Math.max(
      0,
      this.state.flow.expiresAt - this.deps.now()
    );
    const delayMs = Math.min(POLL_INTERVAL_MS, remainingMs);
    this.timer = this.deps.schedule(() => {
      this.timer = null;
      void this.pollNow();
    }, delayMs);
  }

  private async pollNow(): Promise<void> {
    if (this.disposed || this.paused || this.state.phase !== 'active') {
      return;
    }
    const generation = this.generation;
    const flow = this.state.flow;

    try {
      const response = await this.deps.poll(flow.id);
      if (!this.canPublish(generation) || this.paused) return;
      await this.acceptFlow(response.flow, generation);
    } catch (error) {
      if (!this.canPublish(generation) || this.paused) return;
      if (isNotFound(error)) {
        this.transition({
          type: 'failure',
          message: getErrorMessage(error, this.deps.provider),
          notFound: true,
        });
      } else if (flow.expiresAt <= this.deps.now()) {
        this.transition({ type: 'expired', now: this.deps.now() });
      } else {
        this.schedulePoll();
      }
    }
  }

  private cancelTimer(): void {
    if (this.timer === null) return;
    this.deps.cancel(this.timer);
    this.timer = null;
  }
}
