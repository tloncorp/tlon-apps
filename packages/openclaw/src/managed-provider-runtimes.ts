import {
  ensureAuthProfileStore,
  resolveDefaultAgentDir,
} from 'openclaw/plugin-sdk/agent-runtime';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-runtime';
import {
  resolveOwningPluginIdsForProvider,
  resolvePluginProviders,
} from 'openclaw/plugin-sdk/provider-catalog-runtime';

type ProviderResolver = typeof resolvePluginProviders;
type ProviderOwnerResolver = typeof resolveOwningPluginIdsForProvider;
type ProviderRuntimeApi = Pick<
  OpenClawPluginApi,
  'config' | 'logger' | 'registerProvider'
>;

type ProviderRuntimeRegistrationOptions = {
  /**
   * Provider refs learned after startup, such as a newly connected account.
   * Repeated calls against the same plugin API are safe.
   */
  additionalProviderRefs?: readonly string[];
  /** Test seam; production reads the active agent auth store. */
  storedProviderRefs?: readonly string[];
  resolveOwners?: ProviderOwnerResolver;
  resolveProviders?: ProviderResolver;
};

type RegistrationState = {
  pluginIds: Set<string>;
  providerIds: Set<string>;
};

const registrationState = new WeakMap<object, RegistrationState>();

function normalizeProviderRef(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]*$/.test(normalized) ? normalized : null;
}

function providerFromModelRef(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const modelRef = value.trim();
  const separator = modelRef.indexOf('/');
  if (separator <= 0 || separator === modelRef.length - 1) {
    return null;
  }
  return normalizeProviderRef(modelRef.slice(0, separator));
}

function collectModelSelection(value: unknown, modelRefs: Set<string>) {
  if (typeof value === 'string') {
    if (providerFromModelRef(value)) {
      modelRefs.add(value.trim());
    }
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }
  const selection = value as { primary?: unknown; fallbacks?: unknown };
  collectModelSelection(selection.primary, modelRefs);
  if (Array.isArray(selection.fallbacks)) {
    for (const fallback of selection.fallbacks) {
      collectModelSelection(fallback, modelRefs);
    }
  }
}

function collectAgentModelRefs(
  agent: Record<string, unknown> | undefined,
  modelRefs: Set<string>
) {
  if (!agent) {
    return;
  }
  for (const key of [
    'model',
    'utilityModel',
    'imageModel',
    'imageGenerationModel',
    'videoGenerationModel',
    'musicGenerationModel',
    'voiceModel',
    'pdfModel',
  ]) {
    collectModelSelection(agent[key], modelRefs);
  }

  const models = agent.models;
  if (models && typeof models === 'object' && !Array.isArray(models)) {
    for (const modelRef of Object.keys(models)) {
      collectModelSelection(modelRef, modelRefs);
    }
  }

  const subagents = agent.subagents;
  if (subagents && typeof subagents === 'object' && !Array.isArray(subagents)) {
    collectModelSelection(
      (subagents as Record<string, unknown>).model,
      modelRefs
    );
  }
}

export function collectConfiguredProviderRuntimeRefs(
  config: OpenClawConfig,
  storedProviderRefs: readonly string[] = []
): { modelRefs: string[]; providerRefs: string[] } {
  const modelRefs = new Set<string>();
  collectAgentModelRefs(
    config.agents?.defaults as Record<string, unknown> | undefined,
    modelRefs
  );
  for (const agent of config.agents?.list ?? []) {
    collectAgentModelRefs(
      agent as unknown as Record<string, unknown>,
      modelRefs
    );
  }

  const providerRefs = new Set<string>();
  for (const modelRef of modelRefs) {
    const provider = providerFromModelRef(modelRef);
    if (provider) {
      providerRefs.add(provider);
    }
  }
  for (const provider of Object.keys(config.models?.providers ?? {})) {
    const normalized = normalizeProviderRef(provider);
    if (normalized) {
      providerRefs.add(normalized);
    }
  }
  for (const profile of Object.values(config.auth?.profiles ?? {})) {
    const normalized = normalizeProviderRef(profile?.provider);
    if (normalized) {
      providerRefs.add(normalized);
    }
  }
  for (const provider of storedProviderRefs) {
    const normalized = normalizeProviderRef(provider);
    if (normalized) {
      providerRefs.add(normalized);
    }
  }

  return {
    modelRefs: [...modelRefs],
    providerRefs: [...providerRefs],
  };
}

function readStoredProviderRefs(config: OpenClawConfig): string[] {
  const agentDir = resolveDefaultAgentDir(config);
  const store = ensureAuthProfileStore(agentDir, {
    allowKeychainPrompt: false,
    config,
  });
  return Object.values(store.profiles).flatMap((credential) => {
    const provider = normalizeProviderRef(credential.provider);
    return provider ? [provider] : [];
  });
}

function withProviderPluginAllowlist(
  config: OpenClawConfig,
  pluginIds: readonly string[]
): OpenClawConfig {
  return {
    ...config,
    plugins: {
      ...config.plugins,
      allow: [...new Set([...(config.plugins?.allow ?? []), ...pluginIds])],
    },
  };
}

/**
 * Tlon's generated OpenClaw config uses a restrictive plugin allowlist.
 * Provider manifests can still make models visible while the corresponding
 * runtime hooks remain blocked, which makes a configured model fail as
 * "Unknown model" before provider auth or transport selection runs.
 *
 * Resolve only the bundled provider plugins referenced by model config or the
 * auth store, load them through an in-memory allowlist overlay, and register
 * their provider hooks in the active Tlon plugin registry. The root-managed
 * config is never mutated or written.
 */
export function registerManagedProviderRuntimes(
  api: ProviderRuntimeApi,
  options: ProviderRuntimeRegistrationOptions = {}
): string[] {
  const allow = api.config.plugins?.allow;
  if (!Array.isArray(allow) || allow.length === 0) {
    return [];
  }

  let storedProviderRefs = options.storedProviderRefs;
  if (!storedProviderRefs) {
    try {
      storedProviderRefs = readStoredProviderRefs(api.config);
    } catch (error) {
      api.logger.warn(
        `[tlon] Failed to inspect stored provider profiles: ${String(error)}`
      );
      storedProviderRefs = [];
    }
  }

  const refs = collectConfiguredProviderRuntimeRefs(api.config, [
    ...storedProviderRefs,
    ...(options.additionalProviderRefs ?? []),
  ]);
  if (refs.providerRefs.length === 0) {
    return [];
  }

  const state =
    registrationState.get(api as object) ??
    ({
      pluginIds: new Set(),
      providerIds: new Set(),
    } satisfies RegistrationState);
  registrationState.set(api as object, state);

  const resolveOwners =
    options.resolveOwners ?? resolveOwningPluginIdsForProvider;
  const ownersByProvider = new Map<string, string[]>();
  const missingPluginIds = new Set<string>();
  const allowedPluginIds = new Set(allow);

  try {
    for (const provider of refs.providerRefs) {
      const owners =
        resolveOwners({
          provider,
          config: api.config,
          workspaceDir: api.config.agents?.defaults?.workspace,
        }) ?? [];
      const missingOwners = owners.filter(
        (pluginId) =>
          !allowedPluginIds.has(pluginId) &&
          !state.pluginIds.has(pluginId) &&
          api.config.plugins?.entries?.[pluginId]?.enabled !== false
      );
      if (missingOwners.length > 0) {
        ownersByProvider.set(provider, missingOwners);
        for (const pluginId of missingOwners) {
          missingPluginIds.add(pluginId);
        }
      }
    }

    if (missingPluginIds.size === 0) {
      return [];
    }

    const providerRefs = [...ownersByProvider.keys()];
    const providerRefSet = new Set(providerRefs);
    const modelRefs = refs.modelRefs.filter((modelRef) => {
      const provider = providerFromModelRef(modelRef);
      return provider ? providerRefSet.has(provider) : false;
    });
    const pluginIds = [...missingPluginIds];
    const config = withProviderPluginAllowlist(api.config, pluginIds);
    const providers = (options.resolveProviders ?? resolvePluginProviders)({
      config,
      providerRefs,
      modelRefs,
      onlyPluginIds: pluginIds,
      activate: false,
      cache: false,
      applyAutoEnable: true,
      ...(typeof config.agents?.defaults?.workspace === 'string' &&
      config.agents.defaults.workspace.trim()
        ? { workspaceDir: config.agents.defaults.workspace }
        : {}),
    });
    const missingPluginSet = new Set(pluginIds);
    const loadedPluginIds = new Set<string>();
    const registered: string[] = [];

    for (const provider of providers) {
      if (
        !provider.pluginId ||
        !missingPluginSet.has(provider.pluginId) ||
        state.providerIds.has(provider.id)
      ) {
        continue;
      }
      api.registerProvider(provider);
      state.providerIds.add(provider.id);
      loadedPluginIds.add(provider.pluginId);
      registered.push(provider.id);
    }
    for (const pluginId of loadedPluginIds) {
      state.pluginIds.add(pluginId);
    }

    const unresolved = pluginIds.filter(
      (pluginId) => !loadedPluginIds.has(pluginId)
    );
    if (unresolved.length > 0) {
      api.logger.warn(
        `[tlon] Managed provider runtimes unavailable: ${unresolved.join(', ')}`
      );
    }
    if (registered.length > 0) {
      api.logger.info(
        `[tlon] Managed provider runtimes enabled: ${registered.join(', ')}`
      );
    }
    return registered;
  } catch (error) {
    api.logger.warn(
      `[tlon] Failed to enable managed provider runtimes: ${String(error)}`
    );
    return [];
  }
}
