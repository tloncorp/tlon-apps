import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configureHostingSessionStore,
  deleteTlawnProviderKey,
  disconnectTlawnLLMAuth,
  getTlawnLLMAuthFlow,
  getTlawnLLMAuthStatus,
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
});
