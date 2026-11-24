import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useOpenAISubscriptionAuth } from './useOpenAISubscriptionAuth';

const mocks = vi.hoisted(() => ({
  openURL: vi.fn(),
  openOAuthUrl: vi.fn(),
  pollAuth: vi.fn(),
  setQueryData: vi.fn(),
  startAuth: vi.fn(),
  completeAuth: vi.fn(),
  getAuthStatus: vi.fn(),
  trackSettingUpdated: vi.fn(),
  queryClient: null as null | { setQueryData: ReturnType<typeof vi.fn> },
}));

mocks.queryClient = { setQueryData: mocks.setQueryData };

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@tloncorp/api', () => ({
  startTlawnLLMAuth: mocks.startAuth,
  completeTlawnLLMAuth: mocks.completeAuth,
  getTlawnLLMAuthFlow: mocks.pollAuth,
  getTlawnLLMAuthStatus: mocks.getAuthStatus,
}));

vi.mock('./botSettingsTelemetry', () => ({
  trackTlonbotSettingUpdated: mocks.trackSettingUpdated,
}));

vi.mock('../openOAuthUrl', () => ({ openOAuthUrl: mocks.openOAuthUrl }));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackEvent: vi.fn(), trackError: vi.fn() }),
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Linking: { openURL: mocks.openURL },
}));

describe('useOpenAISubscriptionAuth', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startAuth.mockResolvedValue({
      flow: {
        id: 'flow-1',
        provider: 'openai',
        status: 'awaiting_browser',
        expiresAt: Date.now() + 60_000,
        userCode: 'ABCD-EFGH',
        verificationUrl: 'https://auth.openai.com/codex/device',
      },
    });
    mocks.pollAuth.mockImplementation(() => mocks.startAuth());
    mocks.openOAuthUrl.mockResolvedValue({ type: 'returned' });
  });

  it('shows the device code before opening the verification page explicitly', async () => {
    let auth: ReturnType<typeof useOpenAISubscriptionAuth> | null = null;
    let renderer: ReactTestRenderer;

    function Harness() {
      const currentAuth = useOpenAISubscriptionAuth({
        ship: 'zod',
        onComplete: vi.fn(),
      });

      React.useEffect(() => {
        auth = currentAuth;
      }, [currentAuth]);

      return null;
    }

    await act(async () => {
      renderer = create(<Harness />);
    });

    await act(async () => {
      await auth!.start();
    });

    expect(auth!.state).toMatchObject({
      phase: 'active',
      flow: { userCode: 'ABCD-EFGH' },
    });
    expect(mocks.openURL).not.toHaveBeenCalled();
    expect(mocks.openOAuthUrl).not.toHaveBeenCalled();

    await act(async () => {
      await auth!.openVerificationUrl();
    });
    expect(mocks.openOAuthUrl).toHaveBeenCalledWith(
      'https://auth.openai.com/codex/device',
      null
    );
    expect(mocks.openURL).not.toHaveBeenCalled();
    expect(mocks.pollAuth).toHaveBeenCalledWith('zod', 'flow-1');
    expect(auth!.state.phase).toBe('active');

    act(() => renderer!.unmount());
  });

  it('starts the requested xAI provider flow', async () => {
    let auth: ReturnType<typeof useOpenAISubscriptionAuth> | null = null;
    let renderer: ReactTestRenderer;
    mocks.startAuth.mockResolvedValue({
      flow: {
        id: 'flow-xai',
        provider: 'xai',
        status: 'awaiting_browser',
        expiresAt: Date.now() + 60_000,
        userCode: 'GROK-CODE',
        verificationUrl: 'https://accounts.x.ai/authorize',
      },
    });

    function Harness() {
      const currentAuth = useOpenAISubscriptionAuth({
        ship: 'zod',
        provider: 'xai',
        onComplete: vi.fn(),
      });
      React.useEffect(() => {
        auth = currentAuth;
      }, [currentAuth]);
      return null;
    }

    await act(async () => {
      renderer = create(<Harness />);
    });
    await act(async () => {
      await auth!.start();
    });

    expect(mocks.startAuth).toHaveBeenCalledWith('zod', 'xai');
    expect(auth!.state).toMatchObject({
      phase: 'active',
      flow: { provider: 'xai', userCode: 'GROK-CODE' },
    });

    await act(async () => {
      await auth!.openVerificationUrl();
    });
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://accounts.x.ai/authorize'
    );
    expect(mocks.openOAuthUrl).not.toHaveBeenCalled();

    act(() => renderer!.unmount());
  });

  it('submits an Anthropic setup token to the active flow', async () => {
    let auth: ReturnType<typeof useOpenAISubscriptionAuth> | null = null;
    let renderer: ReactTestRenderer;
    const awaitingToken = {
      id: 'flow-anthropic',
      provider: 'anthropic',
      status: 'awaiting_token',
      expiresAt: Date.now() + 60_000,
    };
    mocks.startAuth.mockResolvedValue({ flow: awaitingToken });
    mocks.completeAuth.mockResolvedValue({
      flow: { ...awaitingToken, status: 'authenticating' },
    });

    function Harness() {
      const currentAuth = useOpenAISubscriptionAuth({
        ship: 'zod',
        provider: 'anthropic',
        onComplete: vi.fn(),
      });
      React.useEffect(() => {
        auth = currentAuth;
      }, [currentAuth]);
      return null;
    }

    await act(async () => {
      renderer = create(<Harness />);
    });
    await act(async () => {
      await auth!.start();
      await auth!.completeToken(' setup-token ');
    });

    expect(mocks.completeAuth).toHaveBeenCalledWith(
      'zod',
      'flow-anthropic',
      'setup-token'
    );
    expect(auth!.state).toMatchObject({
      phase: 'active',
      flow: { provider: 'anthropic', status: 'authenticating' },
    });

    act(() => renderer!.unmount());
  });

  it('confirms ChatGPT only after checking the server when the browser returns', async () => {
    let auth: ReturnType<typeof useOpenAISubscriptionAuth>;
    let renderer: ReactTestRenderer;
    const onComplete = vi.fn();
    mocks.pollAuth.mockResolvedValue({
      flow: {
        id: 'flow-1',
        provider: 'openai',
        status: 'complete',
        expiresAt: Date.now() + 60_000,
      },
    });
    mocks.getAuthStatus.mockResolvedValue({
      ts: Date.now(),
      providers: [{ provider: 'openai', status: 'ok' }],
      subscriptionModels: { openai: [{ id: 'gpt-test' }] },
    });
    function Harness() {
      const currentAuth = useOpenAISubscriptionAuth({
        ship: 'zod',
        onComplete,
      });
      React.useEffect(() => {
        auth = currentAuth;
      }, [currentAuth]);
      return null;
    }
    await act(async () => {
      renderer = create(<Harness />);
    });
    await act(async () => {
      await auth.start();
    });
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => {
      await auth.openVerificationUrl();
    });
    expect(auth!.state.phase).toBe('connected');
    expect(onComplete).toHaveBeenCalledWith([{ id: 'gpt-test' }]);
    expect(mocks.trackSettingUpdated).toHaveBeenCalledWith({
      setting: 'subscription',
      action: 'connected',
      provider: 'openai',
    });
    act(() => renderer.unmount());
  });

  it('tracks the provider after a subscription is successfully connected', async () => {
    let auth: ReturnType<typeof useOpenAISubscriptionAuth> | null = null;
    let renderer: ReactTestRenderer;
    const onComplete = vi.fn();
    const awaitingToken = {
      id: 'flow-anthropic',
      provider: 'anthropic',
      status: 'awaiting_token',
      expiresAt: Date.now() + 60_000,
    };
    mocks.startAuth.mockResolvedValue({ flow: awaitingToken });
    mocks.completeAuth.mockResolvedValue({
      flow: { ...awaitingToken, status: 'complete' },
    });
    mocks.getAuthStatus.mockResolvedValue({
      ts: Date.now(),
      providers: [{ provider: 'anthropic', status: 'connected' }],
      subscriptionModels: {
        anthropic: [{ id: 'claude-test' }],
      },
    });

    function Harness() {
      const currentAuth = useOpenAISubscriptionAuth({
        ship: 'zod',
        provider: 'anthropic',
        onComplete,
      });
      React.useEffect(() => {
        auth = currentAuth;
      }, [currentAuth]);
      return null;
    }

    await act(async () => {
      renderer = create(<Harness />);
    });
    await act(async () => {
      await auth!.start();
      await auth!.completeToken('setup-token');
    });

    expect(mocks.trackSettingUpdated).toHaveBeenCalledWith({
      setting: 'subscription',
      action: 'connected',
      provider: 'anthropic',
    });
    expect(onComplete).toHaveBeenCalledWith([{ id: 'claude-test' }]);

    act(() => renderer!.unmount());
  });
});
