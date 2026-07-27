import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-runtime';
import { describe, expect, it, vi } from 'vitest';

import { registerSubscriptionProviderRuntimes } from './subscription-provider-runtime.js';

function makeApi(config: OpenClawConfig) {
  return {
    config,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
    registerProvider: vi.fn(),
  } as unknown as Pick<
    OpenClawPluginApi,
    'config' | 'logger' | 'registerProvider'
  >;
}

describe('registerSubscriptionProviderRuntimes', () => {
  it('loads missing bundled providers through an in-memory allowlist overlay', () => {
    const api = makeApi({
      agents: { defaults: { workspace: '/tmp/tlon-workspace' } },
      plugins: { allow: ['tlon', 'memory-core'] },
    });
    const openai = { id: 'openai' };
    const anthropic = { id: 'anthropic' };
    const resolveProviders = vi.fn(() => [openai, anthropic]);

    const registered = registerSubscriptionProviderRuntimes(
      api,
      resolveProviders as never
    );

    expect(registered).toEqual(['openai', 'anthropic']);
    expect(resolveProviders).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRefs: ['openai', 'anthropic'],
        onlyPluginIds: ['openai', 'anthropic'],
        activate: false,
        cache: false,
        workspaceDir: '/tmp/tlon-workspace',
        config: expect.objectContaining({
          plugins: expect.objectContaining({
            allow: ['tlon', 'memory-core', 'openai', 'anthropic'],
          }),
        }),
      })
    );
    expect(api.registerProvider).toHaveBeenNthCalledWith(1, openai);
    expect(api.registerProvider).toHaveBeenNthCalledWith(2, anthropic);
    expect(api.config.plugins?.allow).toEqual(['tlon', 'memory-core']);
  });

  it('does nothing when the config has no restrictive allowlist', () => {
    const api = makeApi({});
    const resolveProviders = vi.fn();

    expect(
      registerSubscriptionProviderRuntimes(api, resolveProviders as never)
    ).toEqual([]);
    expect(resolveProviders).not.toHaveBeenCalled();
  });

  it('does not override an explicitly disabled provider', () => {
    const api = makeApi({
      plugins: {
        allow: ['tlon', 'openai'],
        entries: {
          anthropic: { enabled: false },
        },
      },
    });
    const resolveProviders = vi.fn();

    expect(
      registerSubscriptionProviderRuntimes(api, resolveProviders as never)
    ).toEqual([]);
    expect(resolveProviders).not.toHaveBeenCalled();
  });

  it('warns and keeps the gateway running when a provider cannot load', () => {
    const api = makeApi({
      plugins: { allow: ['tlon', 'anthropic'] },
    });
    const resolveProviders = vi.fn(() => []);

    expect(
      registerSubscriptionProviderRuntimes(api, resolveProviders as never)
    ).toEqual([]);
    expect(api.logger.warn).toHaveBeenCalledWith(
      '[tlon] Subscription provider runtime unavailable: openai'
    );
  });

  it('loads the bundled OpenClaw 7.1 runtime hooks', () => {
    const api = makeApi({
      plugins: { allow: ['tlon'] },
    });

    const registered = registerSubscriptionProviderRuntimes(api);
    const providerById = new Map(
      vi
        .mocked(api.registerProvider)
        .mock.calls.map(([provider]) => [provider.id, provider])
    );

    expect(new Set(registered)).toEqual(new Set(['openai', 'anthropic']));
    expect(providerById.get('openai')?.resolveDynamicModel).toBeTypeOf(
      'function'
    );
    expect(
      providerById.get('openai')?.resolveDynamicModel?.({
        provider: 'openai',
        modelId: 'gpt-5.6-luna',
        modelRegistry: { find: () => undefined },
        authProfileId: 'openai:test@example.com',
        authProfileMode: 'oauth',
      } as never)
    ).toMatchObject({
      id: 'gpt-5.6-luna',
      provider: 'openai',
      api: 'openai-chatgpt-responses',
      baseUrl: 'https://chatgpt.com/backend-api/codex',
    });
    expect(providerById.get('openai')?.refreshOAuth).toBeTypeOf('function');
    expect(providerById.get('anthropic')?.resolveDynamicModel).toBeTypeOf(
      'function'
    );
  });
});
