import { useFocusEffect } from '@react-navigation/native';
import * as api from '@tloncorp/api';
import type { A2UI } from '@tloncorp/shared/logic';
import { Icon, LoadingSpinner, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { useCurrentUserId } from '../../../hooks/useCurrentUser';
import {
  type McpProviderRow,
  buildProviderRows,
  prioritizeMcpMenuProviders,
} from '../../../lib/mcpProviders';
import { McpProviderLogo } from '../McpProviderLogo';

type McpProviderSnapshot = {
  providers: api.TlawnOAuthProvider[];
  status: api.TlawnOAuthStatus;
};

// Channel screens are normally popped when the owner leaves them, so local
// component state cannot preserve this historical row's height. Keep the last
// successful Hosting snapshot for each account and refresh it in place.
const providerSnapshots = new Map<string, McpProviderSnapshot>();

export function McpConnectControl({
  component,
  completionConsumed,
  configuredProviderIds,
  onConfigure,
  onComplete,
  onNavigate,
}: {
  component: A2UI.McpConnect;
  completionConsumed?: boolean;
  configuredProviderIds?: string[];
  onConfigure?: (
    action: A2UI.ConfigureAgentProvidersAction
  ) => void | Promise<void>;
  onComplete?: (action: A2UI.SendMessageAction) => void | Promise<void>;
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
      configuredProviderIds={configuredProviderIds}
      failed={failed}
      loading={loading}
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
  configuredProviderIds,
  failed = false,
  loading = false,
  onConfigure,
  onComplete,
  onNavigate,
  providers,
}: {
  component: A2UI.McpConnect;
  completionConsumed?: boolean;
  configuredProviderIds?: string[];
  failed?: boolean;
  loading?: boolean;
  onConfigure?: (
    action: A2UI.ConfigureAgentProvidersAction
  ) => void | Promise<void>;
  onComplete?: (action: A2UI.SendMessageAction) => void | Promise<void>;
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
    if (!initializedRef.current) {
      if (loading) return;
      initializedRef.current = true;
      knownConnectedRef.current = connected;
      setSelectedProviderIds(
        configuredProviderIds?.filter((id) => connected.has(id)) ??
          connectedProviderIds
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
    if (newlyConnected.length) {
      setSelectedProviderIds((current) => [
        ...new Set([...current, ...newlyConnected]),
      ]);
    }
  }, [configuredProviderIds, connectedProviderIds, loading]);

  const visibleProviders = providers.slice(0, component.maxVisible);
  const showSeeAll = providers.length > component.maxVisible;

  const toggleProvider = useCallback((providerId: string) => {
    setSelectedProviderIds((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId]
    );
  }, []);

  const configure = useCallback(async () => {
    if (!onConfigure || configuringRef.current) {
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
            providerIds: selectedProviderIds,
          },
        },
      });
    } finally {
      configuringRef.current = false;
      setSubmitting(false);
    }
  }, [component.configureAction.event, onConfigure, selectedProviderIds]);

  const complete = useCallback(async () => {
    if (
      !component.completionAction ||
      !onComplete ||
      completingRef.current ||
      completionConsumed ||
      completedLocally
    ) {
      return;
    }
    completingRef.current = true;
    setCompleting(true);
    try {
      await onComplete(component.completionAction);
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
    component.completionAction,
    onComplete,
  ]);

  const navigate = useCallback(
    (providerId?: string) => {
      if (!onNavigate) return;
      const target = component.action.event.context.target;
      void onNavigate({
        event: {
          ...component.action.event,
          context: {
            target: {
              ...target,
              ...(providerId ? { providerId } : {}),
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
                <Pressable
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
                >
                  <XStack
                    minHeight={56}
                    paddingVertical="$s"
                    paddingHorizontal="$m"
                    backgroundColor="$background"
                    borderBottomWidth={
                      index < visibleProviders.length - 1 || showSeeAll ? 1 : 0
                    }
                    borderBottomColor="$border"
                    alignItems="center"
                    gap="$m"
                    opacity={enabled ? 1 : 0.5}
                  >
                    <McpProviderLogo
                      compact
                      displayName={provider.displayName}
                      logoUrl={provider.logoUrl}
                      providerId={provider.id}
                    />
                    <YStack flex={1} minWidth={0}>
                      <Text
                        size="$label/l"
                        color="$primaryText"
                        trimmed={false}
                        numberOfLines={1}
                      >
                        {provider.displayName}
                      </Text>
                      {connected ? (
                        <Text size="$label/s" color="$secondaryText">
                          Connected
                        </Text>
                      ) : null}
                    </YStack>
                    {connected && !selected ? (
                      <XStack width={16} height={16} />
                    ) : (
                      <Icon
                        type={selected ? 'Checkmark' : 'ChevronRight'}
                        color={
                          selected ? '$positiveActionText' : '$secondaryText'
                        }
                        customSize={[16, 16]}
                      />
                    )}
                  </XStack>
                </Pressable>
              );
            })}
            {showSeeAll ? (
              <Pressable
                testID="A2UIMcpConnectSeeAll"
                accessibilityLabel={component.seeAllLabel}
                disabled={!onNavigate}
                onPress={onNavigate ? () => navigate() : undefined}
              >
                <XStack
                  minHeight={52}
                  paddingHorizontal="$m"
                  backgroundColor="$background"
                  alignItems="center"
                  gap="$m"
                  opacity={onNavigate ? 1 : 0.5}
                >
                  <Text
                    size="$label/l"
                    color="$primaryText"
                    trimmed={false}
                    flex={1}
                  >
                    {component.seeAllLabel}
                  </Text>
                  <Icon
                    type="ChevronRight"
                    color="$secondaryText"
                    customSize={[16, 16]}
                  />
                </XStack>
              </Pressable>
            ) : null}
          </>
        )}
      </YStack>
      {!loading && !failed && connectedProviderIds.length > 0 ? (
        <Pressable
          testID="A2UIMcpConnectSubmit"
          accessibilityLabel={component.submitLabel}
          accessibilityState={{
            disabled: !onConfigure || submitting,
          }}
          disabled={!onConfigure || submitting}
          onPress={configure}
        >
          <XStack
            minHeight={52}
            marginTop="$m"
            paddingHorizontal="$m"
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$m"
            alignItems="center"
            gap="$m"
            opacity={!onConfigure || submitting ? 0.5 : 1}
          >
            <Text size="$label/l" color="$primaryText" trimmed={false} flex={1}>
              {component.submitLabel}
            </Text>
            {submitting ? (
              <LoadingSpinner size="small" />
            ) : (
              <Icon
                type="Checkmark"
                color="$primaryText"
                customSize={[16, 16]}
              />
            )}
          </XStack>
        </Pressable>
      ) : null}
      {component.completionLabel && component.completionAction ? (
        <Pressable
          testID="A2UIMcpConnectComplete"
          accessibilityLabel={component.completionLabel}
          accessibilityState={{
            disabled:
              !onComplete ||
              completing ||
              completionConsumed ||
              completedLocally,
          }}
          disabled={
            !onComplete || completing || completionConsumed || completedLocally
          }
          onPress={complete}
        >
          <XStack
            minHeight={52}
            marginTop="$m"
            paddingHorizontal="$m"
            backgroundColor="$primaryText"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$m"
            alignItems="center"
            gap="$m"
            opacity={completionConsumed || completedLocally ? 0.5 : 1}
          >
            <Text size="$label/l" color="$background" trimmed={false} flex={1}>
              {component.completionLabel}
            </Text>
            {completing ? (
              <LoadingSpinner size="small" />
            ) : (
              <Icon
                type="Checkmark"
                color="$background"
                customSize={[16, 16]}
              />
            )}
          </XStack>
        </Pressable>
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
    <Pressable
      accessibilityLabel="See all services"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <XStack
        minHeight={52}
        paddingHorizontal="$m"
        backgroundColor="$background"
        alignItems="center"
        gap="$m"
        opacity={disabled ? 0.5 : 1}
      >
        <Text size="$label/l" color="$primaryText" trimmed={false} flex={1}>
          See all services
        </Text>
        <Icon
          type="ChevronRight"
          color="$secondaryText"
          customSize={[16, 16]}
        />
      </XStack>
    </Pressable>
  );
}
