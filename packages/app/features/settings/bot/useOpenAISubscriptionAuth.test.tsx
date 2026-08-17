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
  setQueryData: vi.fn(),
  startAuth: vi.fn(),
  queryClient: null as null | { setQueryData: ReturnType<typeof vi.fn> },
}));

mocks.queryClient = { setQueryData: mocks.setQueryData };

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@tloncorp/api', () => ({
  startTlawnLLMAuth: mocks.startAuth,
  getTlawnLLMAuthFlow: vi.fn(),
  getTlawnLLMAuthStatus: vi.fn(),
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

    await act(async () => {
      await auth!.openVerificationUrl();
    });
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://auth.openai.com/codex/device'
    );

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

    act(() => renderer!.unmount());
  });
});
