import { useIsFocused } from '@react-navigation/native';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { desig } from '@tloncorp/api/lib/urbit';
import * as db from '@tloncorp/shared/db';
import { useCallback, useMemo } from 'react';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import {
  BASIC_PROVIDER_ID,
  BASIC_PROVIDER_MODEL,
  EMPTY_PROVIDER_CONFIG,
  PROVIDER_OPTIONS,
  RETRY_INTERVAL_MS,
} from './constants';
import {
  ModelFormValues,
  hasProviderCredential,
  normalizeMoonName,
  normalizeProviderConfig,
  normalizeTlonbotConfig,
  toBackendModel,
} from './helpers';

/**
 * Identifiers for the tlonbot hosting endpoints. User-level endpoints
 * (provider keys/models) take the hosting account id; ship-level endpoints
 * take the node id without the leading sig.
 */
export function useBotSettingsIds() {
  const currentUserId = useCurrentUserId();
  const hostingUserId = db.hostingUserId.useValue();
  const ship = useMemo(
    () => (currentUserId ? desig(currentUserId) : ''),
    [currentUserId]
  );
  return { ship, hostingUserId };
}

export function useBotSettingsQueries() {
  const { ship, hostingUserId } = useBotSettingsIds();
  // Gate polling on screen focus so leaving the bot settings tree stops the
  // 5s retry loops (desktop drawer screens stay mounted after first visit,
  // and endpoints that never succeed would otherwise poll forever).
  const isFocused = useIsFocused();

  const readyQuery = useQuery({
    queryKey: ['tlonbot', 'ready', ship],
    queryFn: () => api.checkNodeIsTlonbotReady(ship),
    enabled: Boolean(ship) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      query.state.data === true ? false : RETRY_INTERVAL_MS,
  });
  const botReady = readyQuery.data === true;

  // While the gateway is coming up these endpoints can 409/504; poll until
  // the bot is ready and we have data. Inlined per query so react-query's
  // data-type inference stays intact.
  const providerConfigQuery = useQuery({
    queryKey: ['tlonbot', 'provider-config', hostingUserId],
    queryFn: async () =>
      normalizeProviderConfig(await api.getTlawnProviderKeys(hostingUserId)),
    enabled: Boolean(hostingUserId) && isFocused,
    // This can 409/504 while tlawn is starting. Since draft readiness gates on
    // its success, poll until it resolves instead of getting stuck in an error
    // state after the default retries (matching the other tlawn queries).
    retry: false,
    refetchInterval: (query) =>
      query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const configQuery = useQuery({
    queryKey: ['tlonbot', 'settings', ship],
    queryFn: async () =>
      normalizeTlonbotConfig(await api.getTlawnSettings(ship)),
    enabled: Boolean(ship) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      botReady && query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const nicknameQuery = useQuery({
    queryKey: ['tlonbot', 'nickname', ship],
    queryFn: () => api.getTlawnNickname(ship),
    enabled: Boolean(ship) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      botReady && query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const avatarQuery = useQuery({
    queryKey: ['tlonbot', 'avatar', ship],
    queryFn: () => api.getTlawnAvatar(ship),
    enabled: Boolean(ship) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      botReady && query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const channelsQuery = useQuery({
    queryKey: ['tlonbot', 'channels', ship],
    queryFn: () => api.getTlawnChannels(ship),
    enabled: Boolean(ship) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      botReady && query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const moonQuery = useQuery({
    queryKey: ['tlonbot', 'moon', ship],
    queryFn: () => api.getTlawnMoon(ship),
    enabled: Boolean(ship) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      botReady && query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const moon = moonQuery.data ? normalizeMoonName(moonQuery.data, ship) : null;

  const moonChannelsQuery = useQuery({
    queryKey: ['tlonbot', 'moon-channels', ship, moon],
    queryFn: () => api.getTlawnChannels(ship, moon),
    enabled: Boolean(ship && moon) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      botReady && query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const oauthStatusQuery = useQuery({
    queryKey: ['tlonbot', 'oauth-status', ship],
    queryFn: () => api.getTlawnOAuthStatus(ship),
    enabled: Boolean(ship) && isFocused,
    retry: false,
    refetchInterval: (query) =>
      botReady && query.state.data !== undefined ? false : RETRY_INTERVAL_MS,
  });

  const oauthProvidersQuery = useQuery({
    queryKey: ['tlonbot', 'oauth-providers'],
    queryFn: () => api.getTlawnOAuthProviders(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ship,
    hostingUserId,
    botReady,
    readyQuery,
    providerConfigQuery,
    providerConfig: providerConfigQuery.data ?? EMPTY_PROVIDER_CONFIG,
    configQuery,
    nicknameQuery,
    avatarQuery,
    channelsQuery,
    moonQuery,
    moon,
    moonChannelsQuery,
    oauthStatusQuery,
    oauthProvidersQuery,
  };
}

export type BotSettingsQueries = ReturnType<typeof useBotSettingsQueries>;

/**
 * Model lists for every provider the user has a credential for. The Basic
 * provider has a single fixed model and doesn't hit the network.
 */
export function useAllProviderModels(
  providerConfig: api.TlawnProviderConfigInfo
) {
  const { hostingUserId } = useBotSettingsIds();
  const providers = useMemo(
    () =>
      PROVIDER_OPTIONS.map((option) => option.id).filter((option) =>
        hasProviderCredential(providerConfig, option)
      ),
    [providerConfig]
  );
  const fetchableProviders = useMemo(
    () => providers.filter((provider) => provider !== BASIC_PROVIDER_ID),
    [providers]
  );

  // `combine` keeps the aggregate referentially stable across renders and
  // avoids a variable-length useMemo dependency array over the query results.
  const combine = useCallback(
    (
      results: {
        data?: api.TlawnProviderModel[];
        isLoading: boolean;
        error: unknown;
      }[]
    ) => {
      const models: Record<string, api.TlawnProviderModel[]> = {};
      const loading: Record<string, boolean> = {};
      const errors: Record<string, unknown | null> = {};
      fetchableProviders.forEach((provider, index) => {
        models[provider] = results[index]?.data ?? [];
        loading[provider] = results[index]?.isLoading ?? false;
        errors[provider] = results[index]?.error ?? null;
      });
      return { models, loading, errors };
    },
    [fetchableProviders]
  );

  const fetched = useQueries({
    queries: fetchableProviders.map((provider) => ({
      queryKey: ['tlonbot', 'provider-models', hostingUserId, provider],
      queryFn: async () => {
        const response = await api.getTlawnProviderModels(
          hostingUserId,
          provider
        );
        return Array.isArray(response?.data) ? response.data : [];
      },
      enabled: Boolean(hostingUserId && provider),
      retry: false,
    })),
    combine,
  });

  return useMemo(() => {
    const models = { ...fetched.models };
    const loading = { ...fetched.loading };
    const errors = { ...fetched.errors };
    if (providers.includes(BASIC_PROVIDER_ID)) {
      models[BASIC_PROVIDER_ID] = [BASIC_PROVIDER_MODEL];
      loading[BASIC_PROVIDER_ID] = false;
      errors[BASIC_PROVIDER_ID] = null;
    }
    return { providers, models, loading, errors };
  }, [providers, fetched]);
}

export type AllProviderModels = ReturnType<typeof useAllProviderModels>;

export function useBotSettingsMutations() {
  const { ship, hostingUserId } = useBotSettingsIds();
  const queryClient = useQueryClient();

  const setProviderConfig = useCallback(
    (data: api.TlawnProviderConfigInfo) => {
      queryClient.setQueryData(
        ['tlonbot', 'provider-config', hostingUserId],
        normalizeProviderConfig(data)
      );
    },
    [queryClient, hostingUserId]
  );

  // The model picker caches models per provider (['tlonbot','provider-models',
  // user, provider]); adding, replacing, or removing a key can change or unblock
  // that catalog, so drop the stale query after a successful write.
  const invalidateProviderModels = useCallback(
    (provider: string) => {
      queryClient.invalidateQueries({
        queryKey: ['tlonbot', 'provider-models', hostingUserId, provider],
      });
    },
    [queryClient, hostingUserId]
  );

  const saveProviderKey = useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      api.setTlawnProviderKey(hostingUserId, provider, key),
    onSuccess: (data, { provider }) => {
      setProviderConfig(data);
      invalidateProviderModels(provider);
    },
  });

  const deleteProviderKey = useMutation({
    mutationFn: ({ provider }: { provider: string }) =>
      api.deleteTlawnProviderKey(hostingUserId, provider),
    onSuccess: (data, { provider }) => {
      setProviderConfig(data);
      invalidateProviderModels(provider);
    },
  });

  const updateNickname = useMutation({
    mutationFn: (nickname: string) => api.setTlawnNickname(ship, nickname),
    onSuccess: (data) => {
      queryClient.setQueryData(['tlonbot', 'nickname', ship], data);
    },
  });

  const savePrimaryModel = useMutation({
    mutationFn: (update: ModelFormValues) => {
      // A row with a provider but no model (or vice versa) is incomplete. Fail
      // rather than silently dropping it, so the caller doesn't mark a fallback
      // change as applied while the server actually saved nothing for it. Basic
      // is exempt: it has no model picker (toBackendModel pins the fixed default),
      // so a Basic fallback with an empty model is complete.
      const hasPartialFallback = update.fallbacks.some(
        (fallback) =>
          fallback.provider !== BASIC_PROVIDER_ID &&
          Boolean(fallback.provider) !== Boolean(fallback.model)
      );
      if (hasPartialFallback) {
        throw new Error(
          'Select both a provider and a model for each fallback, or remove it.'
        );
      }
      // toBackendModel persists "basic" as its own provider (Basic has no model
      // picker, so it pins the fixed default) and passes real providers through
      // unchanged. applyChanges skips the empty-model guard for Basic, so this
      // is also what prevents a provider-only switch to Basic from persisting an
      // empty/stale model.
      return api.setTlawnPrimaryModel(hostingUserId, {
        ...toBackendModel(update.provider, update.model),
        fallbacks: update.fallbacks
          .filter(
            (fallback) =>
              fallback.provider &&
              (fallback.model || fallback.provider === BASIC_PROVIDER_ID)
          )
          .map((fallback) => toBackendModel(fallback.provider, fallback.model)),
      });
    },
    onSuccess: setProviderConfig,
  });

  return {
    ship,
    hostingUserId,
    queryClient,
    setProviderConfig,
    saveProviderKey,
    deleteProviderKey,
    updateNickname,
    savePrimaryModel,
  };
}
