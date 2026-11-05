import * as api from '@tloncorp/api';
import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { openOAuthUrl, type OAuthUrlOpenResult } from './openOAuthUrl';
import { useMcpConnections } from './useMcpConnections';

const mocks = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  appStateListeners: new Set<(state: string) => void>(),
  onEvent: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  startTlawnOAuth: vi.fn(async () => ({ authUrl: 'https://provider.example' })),
  getTlawnOAuthProviders: vi.fn(async () => []),
  getTlawnOAuthStatus: vi.fn(async () => ({ available: true, grants: [] })),
}));
vi.mock('@tloncorp/shared/db', () => ({
  hostingAuthToken: { getValue: async () => 'token' },
  hostingUserId: { getValue: async () => 'user' },
  queryClient: { setQueryData: vi.fn() },
}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {},
  createDevLogger: () => ({ trackEvent: vi.fn(), trackError: vi.fn() }),
  trackEvent: vi.fn(),
}));
vi.mock('@tloncorp/ui', () => ({ triggerHaptic: vi.fn() }));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUserId: () => '~zod',
}));
vi.mock('../../constants', () => ({
  APP_SCHEME: 'io.tlon.groups',
  MCP_OAUTH_COMPLETION_PATH: 'mcp-oauth/complete',
}));
vi.mock('./openOAuthUrl', () => ({ openOAuthUrl: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: mocks.platform,
  Linking: {
    getInitialURL: async () => null,
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appStateListeners.add(listener);
      return { remove: () => mocks.appStateListeners.delete(listener) };
    },
  },
}));

const completion: OAuthUrlOpenResult = {
  type: 'completed',
  url: 'io.tlon.groups://mcp-oauth/complete?provider=notion&status=success',
};
let tree: ReactTestRenderer;
let connections: ReturnType<typeof useMcpConnections>;
function Harness() {
  const value = useMcpConnections({ onEvent: mocks.onEvent });
  useEffect(() => {
    connections = value;
  }, [value]);
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.platform.OS = 'ios';
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  vi.unstubAllGlobals();
});

it.each(['ios', 'android'])(
  'keeps %s busy through foregrounding until the authentication session resolves',
  async (platform) => {
    mocks.platform.OS = platform;
    let finish!: (result: OAuthUrlOpenResult) => void;
    vi.mocked(openOAuthUrl).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await act(async () => {
      tree = create(<Harness />);
    });
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = connections.connect('notion');
    });
    await act(async () => {
      mocks.appStateListeners.forEach((listener) => listener('active'));
    });
    expect(connections.busyProviderId).toBe('notion');
    expect(mocks.onEvent).not.toHaveBeenCalled();
    expect(await connections.connect('github')).toBe('busy');

    await act(async () => {
      finish(completion);
      await pending;
    });
    expect(connections.busyProviderId).toBeNull();
    expect(mocks.onEvent).toHaveBeenCalledTimes(1);
    expect(mocks.onEvent).toHaveBeenCalledWith({
      type: 'completed',
      providerId: 'notion',
      success: true,
      message: 'Connection complete for notion.',
    });
    expect(api.getTlawnOAuthStatus).toHaveBeenCalledTimes(1);
  }
);

it('handles the same callback URL again for a later connection attempt', async () => {
  vi.mocked(openOAuthUrl).mockResolvedValue(completion);
  await act(async () => {
    tree = create(<Harness />);
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await act(async () => {
      await connections.connect('notion');
    });
    expect(connections.busyProviderId).toBeNull();
  }
  expect(mocks.onEvent).toHaveBeenCalledTimes(2);
  expect(api.getTlawnOAuthStatus).toHaveBeenCalledTimes(2);
});

it('refreshes grants after cancellation and lets the user retry', async () => {
  vi.mocked(openOAuthUrl).mockResolvedValueOnce({ type: 'canceled' });
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () => {
    await connections.connect('notion');
  });
  expect(mocks.onEvent).toHaveBeenCalledWith({
    type: 'canceled',
    providerId: 'notion',
  });
  expect(connections.busyProviderId).toBeNull();
  expect(api.getTlawnOAuthStatus).toHaveBeenCalledTimes(1);
  vi.mocked(openOAuthUrl).mockResolvedValueOnce(completion);
  await act(async () => {
    await connections.connect('notion');
  });
  expect(mocks.onEvent).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'completed', success: true })
  );
});
