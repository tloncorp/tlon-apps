import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeTlawnLLMAuth,
  configureHostingSessionStore,
  deleteTlawnProviderKey,
  disconnectTlawnLLMAuth,
  getTlawnLLMAuthFlow,
  getTlawnLLMAuthStatus,
  getTlawnOpenRouterRecommendedModels,
  getTlawnOpenRouterZdrEndpoints,
  startTlawnLLMAuth,
} from './hostingApi';

const validFlow = {
  flow: {
    id: 'flow-1',
    provider: 'openai',
    status: 'awaiting_browser',
    expiresAt: 2_000,
    verificationUrl: 'https://auth.openai.com/codex/device',
    userCode: 'ABCD-EFGH',
  },
};

const providerConfig = {
  keys: {},
  models: [],
  defaultKeys: {},
};

function respond(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

describe('Tlawn provider auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('tlonEnv', {
      API_URL: 'https://hosting.test',
      API_AUTH_USERNAME: undefined,
      API_AUTH_PASSWORD: undefined,
    });
    configureHostingSessionStore({
      authToken: {
        getValue: async () => 'session=abc; HttpOnly;',
        setValue: async () => undefined,
      },
    });
  });

  it('starts and validates an OpenAI device flow', async () => {
    const fetchMock = vi.fn().mockImplementation(() => respond(validFlow, 202));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startTlawnLLMAuth('~zod', 'openai')).resolves.toEqual(
      validFlow
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hosting.test/v1/tlawn/ships/zod/llm-auth/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'openai' }),
      })
    );
  });

  it('starts and validates an xAI device flow', async () => {
    const xaiFlow = {
      flow: {
        ...validFlow.flow,
        provider: 'xai',
        verificationUrl: 'https://accounts.x.ai/authorize',
      },
    };
    const fetchMock = vi.fn().mockImplementation(() => respond(xaiFlow, 202));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startTlawnLLMAuth('~zod', 'xai')).resolves.toEqual(xaiFlow);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hosting.test/v1/tlawn/ships/zod/llm-auth/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'xai' }),
      })
    );
  });

  it('starts and completes an Anthropic setup-token flow', async () => {
    const awaitingToken = {
      flow: {
        id: 'flow-anthropic',
        provider: 'anthropic',
        status: 'awaiting_token',
        expiresAt: 2_000,
      },
    };
    const authenticating = {
      flow: { ...awaitingToken.flow, status: 'authenticating' },
    };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => respond(awaitingToken, 202))
      .mockImplementationOnce(() => respond(authenticating, 202));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startTlawnLLMAuth('~zod', 'anthropic')).resolves.toEqual(
      awaitingToken
    );
    await expect(
      completeTlawnLLMAuth('~zod', 'flow-anthropic', 'setup-token')
    ).resolves.toEqual(authenticating);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://hosting.test/v1/tlawn/ships/zod/llm-auth/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          flowId: 'flow-anthropic',
          token: 'setup-token',
        }),
      })
    );
  });

  it('parses connected status and subscription models', async () => {
    const status = {
      ts: 1_000,
      providers: [
        {
          provider: 'openai',
          displayName: 'OpenAI',
          status: 'ok',
          expiry: { at: 2_000, remainingMs: 1_000, label: 'soon' },
        },
      ],
      subscriptionModels: {
        openai: [{ id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' }],
        anthropic: [{ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }],
        xai: [{ id: 'grok-4.3', name: 'Grok 4.3' }],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => respond(status))
    );

    await expect(getTlawnLLMAuthStatus('zod')).resolves.toEqual(status);
  });

  it('rejects malformed status data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => respond({ ts: 'wrong', providers: [] }))
    );

    await expect(getTlawnLLMAuthStatus('zod')).rejects.toThrow(
      'Invalid model provider login status response.'
    );
  });

  it('polls the encoded path-captured flow id', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      respond({
        flow: {
          ...validFlow.flow,
          id: 'flow/1',
          status: 'authenticating',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await getTlawnLLMAuthFlow('zod', 'flow/1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hosting.test/v1/tlawn/ships/zod/llm-auth/flow/flow%2F1',
      expect.anything()
    );
  });

  it('disconnects OpenAI authentication for the normalized ship', async () => {
    const fetchMock = vi.fn().mockImplementation(() => respond({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await disconnectTlawnLLMAuth('~zod', 'openai');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hosting.test/v1/tlawn/ships/zod/llm-auth/providers/openai',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('passes ship when deleting an OpenAI API key', async () => {
    const fetchMock = vi.fn().mockImplementation(() => respond(providerConfig));
    vi.stubGlobal('fetch', fetchMock);

    await deleteTlawnProviderKey('user-1', 'openai', '~zod');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hosting.test/v1/tlawn/users/user-1/provider-keys/openai?ship=zod',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('loads OpenRouter model metadata from Solaris', async () => {
    const recommendations = ['x-ai/grok-4.6'];
    const endpoints = [
      { modelId: 'x-ai/grok-4.6', providerName: 'xAI', promptPrice: '0.1' },
    ];
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => respond(recommendations))
      .mockImplementationOnce(() => respond(endpoints));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getTlawnOpenRouterRecommendedModels('user-1')
    ).resolves.toEqual(recommendations);
    await expect(getTlawnOpenRouterZdrEndpoints('user-1')).resolves.toEqual(
      endpoints
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://hosting.test/v1/tlawn/users/user-1/openrouter/recommended-models',
      'https://hosting.test/v1/tlawn/users/user-1/openrouter/zdr-endpoints',
    ]);
  });
});
