import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-runtime';
import { resolvePluginProviders } from 'openclaw/plugin-sdk/provider-catalog-runtime';

const SUBSCRIPTION_PROVIDER_IDS = ['openai', 'anthropic'] as const;

type SubscriptionProviderId = (typeof SUBSCRIPTION_PROVIDER_IDS)[number];
type ProviderResolver = typeof resolvePluginProviders;
type ProviderRuntimeApi = Pick<
  OpenClawPluginApi,
  'config' | 'logger' | 'registerProvider'
>;

function enabledMissingProviders(
  config: OpenClawConfig
): SubscriptionProviderId[] {
  const allow = config.plugins?.allow;
  if (!Array.isArray(allow) || allow.length === 0) {
    return [];
  }

  const allowed = new Set(allow);
  return SUBSCRIPTION_PROVIDER_IDS.filter(
    (provider) =>
      !allowed.has(provider) &&
      config.plugins?.entries?.[provider]?.enabled !== false
  );
}

function withProviderRuntimeAllowlist(
  config: OpenClawConfig,
  providers: readonly SubscriptionProviderId[]
): OpenClawConfig {
  return {
    ...config,
    plugins: {
      ...config.plugins,
      allow: [...new Set([...(config.plugins?.allow ?? []), ...providers])],
    },
  };
}

/**
 * Tlon's managed OpenClaw config intentionally uses a restrictive plugin
 * allowlist. OpenClaw's manifest catalog remains visible through that
 * allowlist, but provider runtime hooks do not load, so subscription-backed
 * models fail as "Unknown model" before auth is consulted.
 *
 * Load the bundled provider definitions against an in-memory allowlist overlay
 * and register them into Tlon's active registry. The root-owned config remains
 * untouched, and an explicitly disabled provider stays disabled.
 */
export function registerSubscriptionProviderRuntimes(
  api: ProviderRuntimeApi,
  resolveProviders: ProviderResolver = resolvePluginProviders
): SubscriptionProviderId[] {
  const missingProviders = enabledMissingProviders(api.config);
  if (missingProviders.length === 0) {
    return [];
  }

  try {
    const config = withProviderRuntimeAllowlist(api.config, missingProviders);
    const workspaceDir = config.agents?.defaults?.workspace;
    const providers = resolveProviders({
      config,
      providerRefs: missingProviders,
      onlyPluginIds: missingProviders,
      activate: false,
      cache: false,
      applyAutoEnable: true,
      ...(typeof workspaceDir === 'string' && workspaceDir.trim()
        ? { workspaceDir }
        : {}),
    });
    const missingSet = new Set<string>(missingProviders);
    const registered = new Set<SubscriptionProviderId>();

    for (const provider of providers) {
      const providerId = provider.id as SubscriptionProviderId;
      if (!missingSet.has(providerId) || registered.has(providerId)) {
        continue;
      }
      api.registerProvider(provider);
      registered.add(providerId);
    }

    const unresolved = missingProviders.filter(
      (provider) => !registered.has(provider)
    );
    if (unresolved.length > 0) {
      api.logger.warn(
        `[tlon] Subscription provider runtime unavailable: ${unresolved.join(', ')}`
      );
    }
    if (registered.size > 0) {
      api.logger.info(
        `[tlon] Subscription provider runtime enabled: ${[...registered].join(', ')}`
      );
    }
    return [...registered];
  } catch (error) {
    api.logger.warn(
      `[tlon] Failed to enable subscription provider runtimes: ${String(error)}`
    );
    return [];
  }
}
