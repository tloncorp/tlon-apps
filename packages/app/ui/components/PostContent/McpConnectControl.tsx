import { useFocusEffect } from '@react-navigation/native';
import * as api from '@tloncorp/api';
import { A2UI } from '@tloncorp/shared/logic';
import { Icon, LoadingSpinner } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import {
  type McpProviderRow,
  buildProviderRows,
  prioritizeMcpMenuProviders,
  selectMcpMenuProviders,
} from '../../../lib/mcpProviders';
import { McpProviderLogo } from '../McpProviderLogo';
import { A2UIMenuRow } from './A2UIMenuRow';

type McpProviderSnapshot = {
  providers: api.TlawnOAuthProvider[];
  status: api.TlawnOAuthStatus;
};

// Channel screens are normally popped when the owner leaves them, so local
// component state cannot preserve this historical row's height. Keep the last
// successful Hosting snapshot for each account and refresh it in place.
const providerSnapshots = new Map<string, McpProviderSnapshot>();
const MAX_PROVIDER_SELECTIONS = api.AGENT_PROTOCOL_LIMITS.providerCount;
const clampProviderIds = (providerIds: string[]) =>
  providerIds.slice(0, MAX_PROVIDER_SELECTIONS);

export function McpConnectControl({
  component,
  completionConsumed,
  completionSelection,
  configuredProviderIds,
  onConfigure,
  onComplete,
  onNavigate,
}: {
  component: A2UI.McpConnect;
  /** True when a durable post already answered the completion action. */
  completionConsumed?: boolean;
  /** Durable record to attach to the post the completion action creates. */
  completionSelection?: api.PostBlobDataEntryA2UISelection;
  /** Previously configured providers recovered from the lifecycle receipt. */
  configuredProviderIds?: string[];
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
  const initialSnapshot = currentUserId
    ? providerSnapshots.get(currentUserId)
    : undefined;
  const [loading, setLoading] = useState(!initialSnapshot);
  const [failed, setFailed] = useState(false);
  const [providerConfigs, setProviderConfigs] = useState<
    api.TlawnOAuthProvider[]
  >(initialSnapshot?.providers ?? []);
  const [status, setStatus] = useState<api.TlawnOAuthStatus | null>(
    initialSnapshot?.status ?? null
  );
  const loadedUserIdRef = useRef<string | null>(
    initialSnapshot ? currentUserId : null
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadProviders() {
        if (!currentUserId) {
          if (active) {
            setFailed(true);
            setLoading(false);
          }
          return;
        }

        // Keep the existing rows mounted while refreshing after navigation.
        // Replacing a full menu with a one-row spinner changes the historical
        // message height and makes the conversation jump on every refocus.
        const isInitialLoad = loadedUserIdRef.current !== currentUserId;
        if (isInitialLoad) {
          setLoading(true);
        }
        setFailed(false);
        try {
          const [nextProviders, nextStatus] = await Promise.all([
            api.getTlawnOAuthProviders(),
            api.getTlawnOAuthStatus(currentUserId),
          ]);
          if (active) {
            providerSnapshots.set(currentUserId, {
              providers: nextProviders,
              status: nextStatus,
            });
            setProviderConfigs(nextProviders);
            setStatus(nextStatus);
            loadedUserIdRef.current = currentUserId;
          }
        } catch {
          if (active && isInitialLoad) {
            setFailed(true);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadProviders();
      return () => {
        active = false;
      };
    }, [currentUserId])
  );

  const providers = useMemo(
    () =>
      prioritizeMcpMenuProviders(
        buildProviderRows(providerConfigs, status?.grants ?? [])
      ),
    [providerConfigs, status?.grants]
  );

  return (
    <McpConnectMenu
      component={component}
      completionConsumed={completionConsumed}
      completionSelection={completionSelection}
      configuredProviderIds={configuredProviderIds}
      failed={failed}
      loading={loading}
      providersLoaded={loadedUserIdRef.current === currentUserId}
      onConfigure={onConfigure}
      onComplete={onComplete}
      onNavigate={onNavigate}
      providers={providers}
    />
  );
}

export function McpConnectMenu({
  component,
  completionConsumed = false,
  completionSelection,
  configuredProviderIds,
  failed = false,
  loading = false,
  providersLoaded = true,
  onConfigure,
  onComplete,
  onNavigate,
  providers,
}: {
  component: A2UI.McpConnect;
  completionConsumed?: boolean;
  completionSelection?: api.PostBlobDataEntryA2UISelection;
  configuredProviderIds?: string[];
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
  providers: McpProviderRow[];
}) {
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(false);
  const configuringRef = useRef(false);
  const completingRef = useRef(false);
  const initializedRef = useRef(false);
  const appliedConfigurationRef = useRef<string | null>(null);
  const knownConnectedRef = useRef(new Set<string>());
  const connectedProviderIds = useMemo(
    () =>
      providers
        .filter((provider) => provider.status === 'connected')
        .map((provider) => provider.id),
    [providers]
  );

  useEffect(() => {
    const connected = new Set(connectedProviderIds);
    const configuredKey = configuredProviderIds
      ? [...configuredProviderIds].sort().join('\u0000')
      : null;
    if (!initializedRef.current) {
      if (loading || !providersLoaded) return;
      initializedRef.current = true;
      knownConnectedRef.current = connected;
      appliedConfigurationRef.current = configuredKey;
      setSelectedProviderIds(
        clampProviderIds(
          configuredProviderIds?.filter((id) => connected.has(id)) ??
            connectedProviderIds
        )
      );
      return;
    }

    if (
      configuredKey !== null &&
      configuredKey !== appliedConfigurationRef.current
    ) {
      appliedConfigurationRef.current = configuredKey;
      knownConnectedRef.current = connected;
      setSelectedProviderIds(
        clampProviderIds(
          configuredProviderIds!.filter((id) => connected.has(id))
        )
      );
      return;
    }

    // A provider that became connected while this surface was open was just
    // authorized from this menu. Include it without making the owner tap the
    // same row a second time after returning from OAuth.
    const newlyConnected = connectedProviderIds.filter(
      (id) => !knownConnectedRef.current.has(id)
    );
    knownConnectedRef.current = connected;
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
  }, [configuredProviderIds, connectedProviderIds, loading, providersLoaded]);

  const visibleProviders = useMemo(
    () => selectMcpMenuProviders(providers, component.maxVisible),
    [component.maxVisible, providers]
  );
  const showSeeAll = providers.length > visibleProviders.length;

  const toggleProvider = useCallback((providerId: string) => {
    setSelectedProviderIds((current) => {
      if (current.includes(providerId)) {
        return current.filter((id) => id !== providerId);
      }
      return current.length < MAX_PROVIDER_SELECTIONS
        ? [...current, providerId]
        : current;
    });
  }, []);

  const configure = useCallback(async () => {
    if (!onConfigure || configuringRef.current || completingRef.current) {
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
      // The durable send path reports its own delivery failure. Restore this
      // control without surfacing an unobserved React Native press promise.
    } finally {
      configuringRef.current = false;
      setSubmitting(false);
    }
  }, [component.configureAction.event, onConfigure, selectedProviderIds]);

  const complete = useCallback(async () => {
    if (
      !component.completionAction ||
      !onComplete ||
      configuringRef.current ||
      completingRef.current ||
      completionConsumed ||
      completedLocally
    ) {
      return;
    }
    completingRef.current = true;
    setCompleting(true);
    try {
      await onComplete(component.completionAction, completionSelection);
      setCompletedLocally(true);
    } catch (error) {
      completingRef.current = false;
      throw error;
    } finally {
      setCompleting(false);
    }
  }, [
    completedLocally,
    completionConsumed,
    completionSelection,
    component.completionAction,
    onComplete,
  ]);

  const navigate = useCallback(
    (providerId?: string) => {
      if (!onNavigate) return;
      const target = component.action.event.context.target;
      if (target.type !== 'screen') return;
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
    [component.action.event, onNavigate]
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
            disabled={!onNavigate}
            onPress={() => navigate()}
          />
        ) : (
          <>
            {visibleProviders.map((provider, index) => {
              const connected = provider.status === 'connected';
              const selected = selectedProviderIds.includes(provider.id);
              const enabled = connected
                ? Boolean(onConfigure)
                : Boolean(onNavigate);
              return (
                <A2UIMenuRow
                  key={provider.id}
                  testID={`A2UIMcpConnect-${provider.id}`}
                  accessibilityLabel={provider.displayName}
                  accessibilityState={{
                    disabled: connected ? !onConfigure : !onNavigate,
                    selected,
                  }}
                  disabled={connected ? !onConfigure : !onNavigate}
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
                disabled={!onNavigate}
                onPress={() => navigate()}
                dimmed={!onNavigate}
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
            disabled: !onConfigure || submitting,
          }}
          disabled={!onConfigure || submitting}
          onPress={configure}
          bordered
          marginTop="$m"
          dimmed={!onConfigure || submitting}
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
              completing ||
              completionConsumed ||
              completedLocally,
          }}
          disabled={
            !onComplete ||
            submitting ||
            completing ||
            completionConsumed ||
            completedLocally
          }
          onPress={complete}
          bordered
          marginTop="$m"
          prominent
          dimmed={completionConsumed || completedLocally}
          label={component.completionLabel}
          trailing={
            completing ? (
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
