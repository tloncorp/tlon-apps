import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-runtime';
import { describe, expect, it, vi } from 'vitest';

import {
  collectConfiguredProviderRuntimeRefs,
  registerManagedProviderRuntimes,
} from './managed-provider-runtimes.js';

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

describe('collectConfiguredProviderRuntimeRefs', () => {
  it('collects providers from defaults, agents, custom providers, and auth', () => {
    expect(
      collectConfiguredProviderRuntimeRefs(
        {
          agents: {
            defaults: {
              model: {
                primary: 'openrouter/minimax/minimax-m3',
                fallbacks: ['xai/grok-4'],
              },
              utilityModel: 'openai/gpt-5-mini',
              models: {
                'anthropic/claude-sonnet-5': {},
              },
              subagents: {
                model: 'google/gemini-2.5-pro',
              },
            },
            list: [
              {
                id: 'channel-override',
                model: 'mistral/mistral-large',
              },
            ],
          },
          models: {
            providers: {
              basic: {
                baseUrl: 'https://openrouter.ai/api/v1',
                models: [],
              },
            },
          },
          auth: {
            profiles: {
              'ollama:default': {
                provider: 'ollama',
                mode: 'token',
              },
            },
          },
        },
        ['cohere', 'OPENAI', 'invalid/provider']
      )
    ).toEqual({
      modelRefs: [
        'openrouter/minimax/minimax-m3',
        'xai/grok-4',
        'openai/gpt-5-mini',
        'anthropic/claude-sonnet-5',
        'google/gemini-2.5-pro',
        'mistral/mistral-large',
      ],
      providerRefs: [
        'openrouter',
        'xai',
        'openai',
        'anthropic',
        'google',
        'mistral',
        'basic',
        'ollama',
        'cohere',
      ],
    });
  });
});

describe('registerManagedProviderRuntimes', () => {
  it('loads referenced provider plugins through an in-memory allowlist', () => {
    const api = makeApi({
      agents: {
        defaults: {
          workspace: '/tmp/tlon-workspace',
          model: {
            primary: 'openrouter/minimax/minimax-m3',
            fallbacks: ['xai/grok-4'],
          },
        },
      },
      plugins: { allow: ['tlon', 'memory-core'] },
    });
    const openrouter = { id: 'openrouter', pluginId: 'openrouter' };
    const xai = { id: 'xai', pluginId: 'xai' };
    const resolveOwners = vi.fn(({ provider }: { provider: string }) => [
      provider,
    ]);
    const resolveProviders = vi.fn(() => [openrouter, xai]);

    const registered = registerManagedProviderRuntimes(api, {
      storedProviderRefs: [],
      resolveOwners: resolveOwners as never,
      resolveProviders: resolveProviders as never,
    });

    expect(registered).toEqual(['openrouter', 'xai']);
    expect(resolveProviders).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRefs: ['openrouter', 'xai'],
        modelRefs: ['openrouter/minimax/minimax-m3', 'xai/grok-4'],
        onlyPluginIds: ['openrouter', 'xai'],
        activate: false,
        cache: false,
        workspaceDir: '/tmp/tlon-workspace',
        config: expect.objectContaining({
          plugins: expect.objectContaining({
            allow: ['tlon', 'memory-core', 'openrouter', 'xai'],
          }),
        }),
      })
    );
    expect(api.registerProvider).toHaveBeenNthCalledWith(1, openrouter);
    expect(api.registerProvider).toHaveBeenNthCalledWith(2, xai);
    expect(api.config.plugins?.allow).toEqual(['tlon', 'memory-core']);
  });

  it('does nothing without a restrictive allowlist', () => {
    const api = makeApi({
      agents: {
        defaults: { model: 'openrouter/minimax/minimax-m3' },
      },
    });
    const resolveProviders = vi.fn();

    expect(
      registerManagedProviderRuntimes(api, {
        storedProviderRefs: [],
        resolveProviders: resolveProviders as never,
      })
    ).toEqual([]);
    expect(resolveProviders).not.toHaveBeenCalled();
  });

  it('does not override an explicitly disabled provider plugin', () => {
    const api = makeApi({
      agents: {
        defaults: { model: 'xai/grok-4' },
      },
      plugins: {
        allow: ['tlon'],
        entries: {
          xai: { enabled: false },
        },
      },
    });
    const resolveProviders = vi.fn();

    expect(
      registerManagedProviderRuntimes(api, {
        storedProviderRefs: [],
        resolveOwners: vi.fn(() => ['xai']) as never,
        resolveProviders: resolveProviders as never,
      })
    ).toEqual([]);
    expect(resolveProviders).not.toHaveBeenCalled();
  });

  it('can register a provider learned after startup without duplicates', () => {
    const api = makeApi({
      plugins: { allow: ['tlon'] },
    });
    const resolveOwners = vi.fn(({ provider }: { provider: string }) => [
      provider,
    ]);
    const openai = { id: 'openai', pluginId: 'openai' };
    const resolveProviders = vi.fn(() => [openai]);
    const options = {
      additionalProviderRefs: ['openai'],
      storedProviderRefs: [],
      resolveOwners: resolveOwners as never,
      resolveProviders: resolveProviders as never,
    };

    expect(registerManagedProviderRuntimes(api, options)).toEqual(['openai']);
    expect(registerManagedProviderRuntimes(api, options)).toEqual([]);
    expect(api.registerProvider).toHaveBeenCalledTimes(1);
  });

  it('loads configured and auth-backed provider hooks from pinned OpenClaw', () => {
    const api = makeApi({
      agents: {
        defaults: { model: 'openrouter/minimax/minimax-m3' },
      },
      plugins: { allow: ['tlon'] },
    });

    const registered = registerManagedProviderRuntimes(api, {
      storedProviderRefs: ['openai', 'anthropic'],
    });
    const providerById = new Map(
      vi
        .mocked(api.registerProvider)
        .mock.calls.map(([provider]) => [provider.id, provider])
    );

    expect(registered).toEqual(
      expect.arrayContaining(['openrouter', 'openai', 'anthropic'])
    );
    expect(providerById.get('openrouter')?.resolveDynamicModel).toBeTypeOf(
      'function'
    );
    expect(providerById.get('openai')?.resolveDynamicModel).toBeTypeOf(
      'function'
    );
    const openAIResolver = providerById.get('openai')?.resolveDynamicModel;
    const modelRegistry = { find: () => undefined };
    expect(
      openAIResolver?.({
        provider: 'openai',
        modelId: 'gpt-5.5',
        modelRegistry,
      } as never)
    ).toMatchObject({
      id: 'gpt-5.5',
      provider: 'openai',
      api: 'openai-responses',
      baseUrl: 'https://api.openai.com/v1',
    });
    expect(providerById.get('anthropic')?.resolveDynamicModel).toBeTypeOf(
      'function'
    );
  });
});
