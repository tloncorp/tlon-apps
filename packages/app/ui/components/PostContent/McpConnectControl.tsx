import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { A2UI } from '@tloncorp/shared/logic';
import { Icon, LoadingSpinner } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import {
  type McpProviderRow,
  buildProviderRows,
  mcpProviderQueryKeys,
  prioritizeMcpMenuProviders,
  selectMcpMenuProviders,
} from '../../../lib/mcpProviders';
import { McpProviderLogo } from '../McpProviderLogo';
import { A2UIMenuRow } from './A2UIMenuRow';
import { useOneShotAction } from './useOneShotAction';

const MAX_PROVIDER_SELECTIONS = api.AGENT_PROTOCOL_LIMITS.providerCount;
const pendingProviderSelections = new Map<string, string[]>();
const pendingProviderAuthorizations = new Map<
  string,
  { providerId: string; leftSurface: boolean; returned: boolean }
>();
const clampProviderIds = (providerIds: string[]) =>
  providerIds.slice(0, MAX_PROVIDER_SELECTIONS);

export function McpConnectControl({
  component,
  configuredProviderIds,
  completionConsumed,
  completionSelection,
  onConfigure,
  onComplete,
  onNavigate,
}: {
  component: A2UI.McpConnect;
  configuredProviderIds?: string[];
  /** True when a durable post already answered the completion action. */
  completionConsumed?: boolean;
  /** Durable record to attach to the post the completion action creates. */
  completionSelection?: api.PostBlobDataEntryA2UISelection;
  onConfigure?: (
    action: A2UI.ConfigureAgentProvidersAction
  ) => void | Promise<void>;
  onComplete?: (
    action: A2UI.SendMessageAction,
    selection?: api.PostBlobDataEntryA2UISelection
  ) => void | Promise<void>;
  onNavigate?: (action: A2UI.NavigateAction) => void | Promise<void>;
}) {
  const currentUserId = useCurrentUserId();
  const providersQuery = useQuery({
    queryKey: mcpProviderQueryKeys.providers,
    queryFn: () => api.getTlawnOAuthProviders(),
    staleTime: 5 * 60 * 1000,
    // React Query owns the single app/window focus listener. Historical cards
    // share this cache instead of each installing its own refresh listeners.
    refetchOnWindowFocus: 'always',
    retry: false,
  });
  const statusQuery = useQuery({
    queryKey: mcpProviderQueryKeys.status(currentUserId),
    queryFn: () => api.getTlawnOAuthStatus(currentUserId),
    enabled: Boolean(currentUserId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: 'always',
    retry: false,
  });

  const refreshProviders = useCallback(async () => {
    const [, statusResult] = await Promise.all([
      providersQuery.refetch(),
      currentUserId ? statusQuery.refetch() : Promise.resolve(null),
    ]);
    return Boolean(currentUserId && statusResult && statusResult.isSuccess);
  }, [currentUserId, providersQuery.refetch, statusQuery.refetch]);

  const providers = useMemo(
    () =>
      statusQuery.data?.available === false
        ? []
        : prioritizeMcpMenuProviders(
            buildProviderRows(
              providersQuery.data ?? [],
              statusQuery.data?.grants ?? []
            )
          ),
    [providersQuery.data, statusQuery.data]
  );

  const hasProviderData = providersQuery.data !== undefined;
  const hasStatusData = statusQuery.data !== undefined;
  const failed =
    (providersQuery.isError && !hasProviderData) ||
    (statusQuery.isError && !hasStatusData);

  return (
    <McpConnectMenu
      component={component}
      configuredProviderIds={configuredProviderIds}
      failed={failed}
      loading={!failed && (!hasProviderData || !hasStatusData)}
      providersLoaded={hasProviderData && hasStatusData}
      completionConsumed={completionConsumed}
      completionSelection={completionSelection}
      onConfigure={onConfigure}
      onComplete={onComplete}
      onNavigate={onNavigate}
      onRefreshProviders={refreshProviders}
      providers={providers}
    />
  );
}

export function McpConnectMenu({
  component,
  configuredProviderIds,
  completionConsumed = false,
  completionSelection,
  failed = false,
  loading = false,
  providersLoaded = true,
  onConfigure,
  onComplete,
  onNavigate,
  onRefreshProviders,
  providers,
}: {
  component: A2UI.McpConnect;
  configuredProviderIds?: string[];
  completionConsumed?: boolean;
  completionSelection?: api.PostBlobDataEntryA2UISelection;
  failed?: boolean;
  loading?: boolean;
  providersLoaded?: boolean;
  onConfigure?: (
    action: A2UI.ConfigureAgentProvidersAction
  ) => void | Promise<void>;
  onComplete?: (
    action: A2UI.SendMessageAction,
    selection?: api.PostBlobDataEntryA2UISelection
  ) => void | Promise<void>;
  onNavigate?: (action: A2UI.NavigateAction) => void | Promise<void>;
  onRefreshProviders?: () => Promise<boolean>;
  providers: McpProviderRow[];
}) {
  const selectionKey = `${component.configureAction.event.context.groupId}\u0000${component.configureAction.event.context.provisionId}\u0000${component.id}`;
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>(
    () =>
      pendingProviderSelections.get(selectionKey) ??
      clampProviderIds(configuredProviderIds ?? [])
  );
  const [submitting, setSubmitting] = useState(false);
  const [authorizationReturnVersion, setAuthorizationReturnVersion] =
    useState(0);
  const configuringRef = useRef(false);
  const initializedRef = useRef(false);
  const configuredKeyRef = useRef('');
  const completionAction = useOneShotAction(completionConsumed);
  const connectedProviderIds = useMemo(
    () =>
      providers
        .filter((provider) => provider.status === 'connected')
        .map((provider) => provider.id),
    [providers]
  );

  const markAuthorizationLeftSurface = useCallback(() => {
    const pending = pendingProviderAuthorizations.get(selectionKey);
    if (pending) pending.leftSurface = true;
  }, [selectionKey]);

  const finishAuthorizationRoundTrip = useCallback(() => {
    const pending = pendingProviderAuthorizations.get(selectionKey);
    if (!pending?.leftSurface || pending.returned) return;
    // Claim this return before refreshing so a focus + visibility pair cannot
    // start duplicate refreshes for the same browser round trip.
    pending.leftSurface = false;
    const refresh = onRefreshProviders?.() ?? Promise.resolve(true);
    const finish = (succeeded: boolean) => {
      const current = pendingProviderAuthorizations.get(selectionKey);
      if (current === pending) {
        if (!succeeded) {
          current.leftSurface = true;
          return;
        }
        current.returned = true;
        setAuthorizationReturnVersion((version) => version + 1);
      }
    };
    void refresh.then(finish, () => finish(false));
  }, [onRefreshProviders, selectionKey]);

  useFocusEffect(
    useCallback(() => {
      finishAuthorizationRoundTrip();
      return markAuthorizationLeftSurface;
    }, [finishAuthorizationRoundTrip, markAuthorizationLeftSurface])
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        markAuthorizationLeftSurface();
      } else {
        finishAuthorizationRoundTrip();
      }
    };
    window.addEventListener('blur', markAuthorizationLeftSurface);
    window.addEventListener('focus', finishAuthorizationRoundTrip);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', markAuthorizationLeftSurface);
      window.removeEventListener('focus', finishAuthorizationRoundTrip);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [finishAuthorizationRoundTrip, markAuthorizationLeftSurface]);

  useEffect(() => {
    const connected = new Set(connectedProviderIds);
    if (!initializedRef.current) {
      if (loading || !providersLoaded) return;
      initializedRef.current = true;
      setSelectedProviderIds(
        clampProviderIds(
          configuredProviderIds === undefined
            ? connectedProviderIds
            : configuredProviderIds.filter((id) => connected.has(id))
        )
      );
      return;
    }

    // Shared OAuth queries update every historical control. Auto-select only
    // the provider whose setup this exact surface initiated; a grant made in
    // settings or another group must not silently change this group's config.
    const pendingAuthorization =
      pendingProviderAuthorizations.get(selectionKey);
    const authorizedProviderId = pendingAuthorization?.providerId;
    const newlyConnected =
      pendingAuthorization?.returned === true &&
      authorizedProviderId !== undefined &&
      connected.has(authorizedProviderId)
        ? [authorizedProviderId]
        : [];
    if (pendingAuthorization?.returned) {
      // A returned OAuth round trip owns exactly one refresh. Clear the marker
      // whether it connected, failed, or was canceled so a later settings
      // change cannot be mistaken for this control's authorization.
      pendingProviderAuthorizations.delete(selectionKey);
    }
    setSelectedProviderIds((current) => {
      const next = clampProviderIds([
        ...new Set([
          ...current.filter((id) => connected.has(id)),
          ...newlyConnected,
        ]),
      ]);
      return next.length === current.length &&
        next.every((id, index) => id === current[index])
        ? current
        : next;
    });
  }, [
    authorizationReturnVersion,
    configuredProviderIds,
    connectedProviderIds,
    loading,
    providersLoaded,
    selectionKey,
  ]);

  useEffect(() => {
    if (loading || !providersLoaded || configuredProviderIds === undefined)
      return;
    const configuredKey = [...configuredProviderIds].sort().join('\u0000');
    if (!configuredKey || configuredKey === configuredKeyRef.current) return;
    configuredKeyRef.current = configuredKey;
    const connected = new Set(connectedProviderIds);
    setSelectedProviderIds(
      clampProviderIds(configuredProviderIds.filter((id) => connected.has(id)))
    );
  }, [configuredProviderIds, connectedProviderIds, loading, providersLoaded]);

  useEffect(() => {
    pendingProviderSelections.set(selectionKey, selectedProviderIds);
  }, [selectedProviderIds, selectionKey]);

  useEffect(() => {
    if (completionConsumed) {
      pendingProviderSelections.delete(selectionKey);
      pendingProviderAuthorizations.delete(selectionKey);
    }
  }, [completionConsumed, selectionKey]);

  const visibleProviders = useMemo(
    () => selectMcpMenuProviders(providers, component.maxVisible),
    [component.maxVisible, providers]
  );
  const showSeeAll = providers.length > visibleProviders.length;
  const completionLocked =
    completionAction.consumed || completionAction.pending;

  const toggleProvider = useCallback(
    (providerId: string) => {
      if (configuringRef.current || completionAction.isLocked()) return;
      setSelectedProviderIds((current) => {
        if (current.includes(providerId)) {
          return current.filter((id) => id !== providerId);
        }
        return current.length < MAX_PROVIDER_SELECTIONS
          ? [...current, providerId]
          : current;
      });
    },
    [completionAction]
  );

  const configure = useCallback(async () => {
    if (!onConfigure || configuringRef.current || completionAction.isLocked()) {
      return;
    }
    configuringRef.current = true;
    setSubmitting(true);
    try {
      await onConfigure({
        event: {
          ...component.configureAction.event,
          context: {
            ...component.configureAction.event.context,
            providerIds: clampProviderIds(selectedProviderIds),
          },
        },
      });
    } catch {
      // The post transport records the failure and the control below is
      // released for retry. Consume the rejected callback so a failed send
      // does not also reach the platform's unhandled-rejection handler.
    } finally {
      configuringRef.current = false;
      setSubmitting(false);
    }
  }, [
    completionAction,
    component.configureAction.event,
    onConfigure,
    selectedProviderIds,
  ]);

  const complete = useCallback(async () => {
    if (
      !component.completionAction ||
      !onComplete ||
      configuringRef.current ||
      completionAction.isLocked()
    ) {
      return;
    }
    await completionAction.run(() =>
      onComplete(component.completionAction!, completionSelection)
    );
  }, [
    completionAction,
    completionSelection,
    component.completionAction,
    onComplete,
  ]);

  const navigate = useCallback(
    (providerId?: string) => {
      if (
        !onNavigate ||
        configuringRef.current ||
        completionAction.isLocked()
      ) {
        return;
      }
      const target = component.action.event.context.target;
      if (target.type !== 'screen') return;
      if (providerId) {
        pendingProviderAuthorizations.set(selectionKey, {
          providerId,
          leftSurface: false,
          returned: false,
        });
      } else {
        pendingProviderAuthorizations.delete(selectionKey);
      }
      void onNavigate({
        event: {
          ...component.action.event,
          context: {
            target: {
              ...target,
              providerId,
            },
          },
        },
      });
    },
    [completionAction, component.action.event, onNavigate, selectionKey]
  );

  return (
    <YStack
      width="100%"
      padding="$m"
      borderRadius="$xl"
      backgroundColor="$secondaryBackground"
    >
      <YStack
        width="100%"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$m"
        overflow="hidden"
      >
        {loading ? (
          <XStack
            minHeight={52}
            paddingHorizontal="$m"
            alignItems="center"
            justifyContent="center"
            backgroundColor="$background"
          >
            <LoadingSpinner size="small" />
          </XStack>
        ) : failed || visibleProviders.length === 0 ? (
          <ProviderFallbackRow
            disabled={!onNavigate || submitting || completionLocked}
            onPress={() => navigate()}
          />
        ) : (
          <>
            {visibleProviders.map((provider, index) => {
              const connected = provider.status === 'connected';
              const selected = selectedProviderIds.includes(provider.id);
              const enabled = connected
                ? Boolean(onConfigure) && !submitting && !completionLocked
                : Boolean(onNavigate) && !submitting && !completionLocked;
              const disabled = connected
                ? !onConfigure || submitting || completionLocked
                : !onNavigate || submitting || completionLocked;
              return (
                <A2UIMenuRow
                  key={provider.id}
                  testID={`A2UIMcpConnect-${provider.id}`}
                  accessibilityLabel={provider.displayName}
                  accessibilityState={{
                    disabled,
                    selected,
                  }}
                  disabled={disabled}
                  onPress={
                    connected
                      ? () => toggleProvider(provider.id)
                      : onNavigate
                        ? () => navigate(provider.id)
                        : undefined
                  }
                  minHeight={56}
                  paddingVertical="$s"
                  dividerAfter={
                    index < visibleProviders.length - 1 || showSeeAll
                  }
                  dimmed={!enabled}
                  label={provider.displayName}
                  subtitle={connected ? 'Connected' : undefined}
                  leading={
                    <McpProviderLogo
                      compact
                      displayName={provider.displayName}
                      logoUrl={provider.logoUrl}
                      providerId={provider.id}
                    />
                  }
                  trailing={
                    connected && !selected ? (
                      <XStack width={16} height={16} />
                    ) : (
                      <Icon
                        type={selected ? 'Checkmark' : 'ChevronRight'}
                        color={
                          selected ? '$positiveActionText' : '$secondaryText'
                        }
                        customSize={[16, 16]}
                      />
                    )
                  }
                />
              );
            })}
            {showSeeAll ? (
              <A2UIMenuRow
                testID="A2UIMcpConnectSeeAll"
                accessibilityLabel={component.seeAllLabel}
                disabled={!onNavigate || submitting || completionLocked}
                onPress={() => navigate()}
                dimmed={!onNavigate || submitting || completionLocked}
                label={component.seeAllLabel}
                trailing={
                  <Icon
                    type="ChevronRight"
                    color="$secondaryText"
                    customSize={[16, 16]}
                  />
                }
              />
            ) : null}
          </>
        )}
      </YStack>
      {!loading && !failed && connectedProviderIds.length > 0 ? (
        <A2UIMenuRow
          testID="A2UIMcpConnectSubmit"
          accessibilityLabel={component.submitLabel}
          accessibilityState={{
            disabled: !onConfigure || submitting || completionLocked,
          }}
          disabled={!onConfigure || submitting || completionLocked}
          onPress={configure}
          bordered
          marginTop="$m"
          dimmed={!onConfigure || submitting || completionLocked}
          label={component.submitLabel}
          trailing={
            submitting ? (
              <LoadingSpinner size="small" />
            ) : (
              <Icon
                type="Checkmark"
                color="$primaryText"
                customSize={[16, 16]}
              />
            )
          }
        />
      ) : null}
      {component.completionLabel && component.completionAction ? (
        <A2UIMenuRow
          testID="A2UIMcpConnectComplete"
          accessibilityLabel={component.completionLabel}
          accessibilityState={{
            disabled:
              !onComplete ||
              submitting ||
              completionAction.pending ||
              completionLocked,
          }}
          disabled={
            !onComplete ||
            submitting ||
            completionAction.pending ||
            completionLocked
          }
          onPress={complete}
          bordered
          marginTop="$m"
          prominent
          dimmed={completionLocked}
          label={component.completionLabel}
          trailing={
            completionAction.pending ? (
              <LoadingSpinner size="small" />
            ) : (
              <Icon
                type="Checkmark"
                color="$background"
                customSize={[16, 16]}
              />
            )
          }
        />
      ) : null}
    </YStack>
  );
}

function ProviderFallbackRow({
  disabled,
  onPress,
}: {
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <A2UIMenuRow
      accessibilityLabel="See all services"
      disabled={disabled}
      onPress={onPress}
      dimmed={disabled}
      label="See all services"
      trailing={
        <Icon
          type="ChevronRight"
          color="$secondaryText"
          customSize={[16, 16]}
        />
      }
    />
  );
}
