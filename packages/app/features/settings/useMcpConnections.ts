import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { triggerHaptic } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { mcpProviderQueryKeys } from '../../lib/mcpProviders';
import { trackTlonbotSettingUpdated } from './bot/botSettingsTelemetry';
import {
  MCP_TELEMETRY_EVENTS,
  buildProviderRows,
  getFinalRedirectUrl,
  parseOAuthCompletionUrl,
  trackMcpError,
  trackMcpEvent,
} from './botMcpSettingsHelpers';
import { openOAuthUrl } from './openOAuthUrl';

/**
 * What happened to a connection attempt or a status load. Screens decide how
 * to show it: settings shows toasts, onboarding updates the service's row.
 */
export type McpConnectionEvent =
  | { type: 'load-failed' }
  | {
      type: 'completed';
      providerId: string | null;
      success: boolean;
      message: string;
    }
  | { type: 'canceled'; providerId: string }
  | { type: 'start-failed'; providerId: string }
  /** Back in the app after the provider's page, with no completion link. */
  | { type: 'returned'; providerId: string }
  | { type: 'disconnected'; providerId: string }
  | { type: 'disconnect-failed'; providerId: string };

/**
 * The connector catalog, this account's grants, and connecting or
 * disconnecting a service through the provider's own sign-in. Shared by the
 * Connect services screen and the first run's services step.
 */
export function useMcpConnections({
  onEvent,
}: {
  onEvent?: (event: McpConnectionEvent) => void;
} = {}) {
  const currentUserId = useCurrentUserId();
  const [providerConfigs, setProviderConfigs] = useState<
    api.TlawnOAuthProvider[]
  >([]);
  const [status, setStatus] = useState<api.TlawnOAuthStatus | null>(null);
  const [hostingSessionUnavailable, setHostingSessionUnavailable] =
    useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingProviderId, setStartingProviderId] = useState<string | null>(
    null
  );
  const [disconnectingProviderId, setDisconnectingProviderId] = useState<
    string | null
  >(null);
  const handledCompletionUrls = useRef(new Set<string>());
  // Read by the completion handler, which can run before a re-render.
  const startingProviderIdRef = useRef<string | null>(null);
  const setStarting = useCallback((providerId: string | null) => {
    startingProviderIdRef.current = providerId;
    setStartingProviderId(providerId);
  }, []);
  const isMounted = useRef(true);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const emit = useCallback((event: McpConnectionEvent) => {
    onEventRef.current?.(event);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refreshStatus =
    useCallback(async (): Promise<api.TlawnOAuthStatus | null> => {
      if (!currentUserId) {
        setInitialLoading(false);
        trackMcpError('OAuth status requested without current user', {
          action: 'loadStatus',
        });
        emit({ type: 'load-failed' });
        return null;
      }

      setRefreshing(true);
      try {
        const [authToken, hostingUserId] = await Promise.all([
          db.hostingAuthToken.getValue(),
          db.hostingUserId.getValue(),
        ]);
        if (!authToken || !hostingUserId) {
          if (isMounted.current) {
            setHostingSessionUnavailable(true);
            setProviderConfigs([]);
            setStatus(null);
          }
          return null;
        }

        if (isMounted.current) {
          setHostingSessionUnavailable(false);
        }
        const [nextProviders, nextStatus] = await Promise.all([
          api.getTlawnOAuthProviders(),
          api.getTlawnOAuthStatus(currentUserId),
        ]);
        // These screens own mutations to connector grants. Publish their
        // authoritative refresh into the shared cache so mounted chat
        // controls reflect changes made here.
        db.queryClient.setQueryData(
          mcpProviderQueryKeys.providers,
          nextProviders
        );
        db.queryClient.setQueryData(
          mcpProviderQueryKeys.status(currentUserId),
          nextStatus
        );
        if (isMounted.current) {
          setProviderConfigs(nextProviders);
          setStatus(nextStatus);
        }
        return nextStatus;
      } catch (err) {
        trackMcpError('Failed to load OAuth status', {
          action: 'loadStatus',
          error: err,
        });
        if (isMounted.current) {
          emit({ type: 'load-failed' });
        }
        return null;
      } finally {
        if (isMounted.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    }, [currentUserId, emit]);

  const handleOAuthCompletion = useCallback(
    (url: string) => {
      if (handledCompletionUrls.current.has(url)) {
        return;
      }

      const completion = parseOAuthCompletionUrl(url);
      if (!completion) {
        return;
      }

      handledCompletionUrls.current.add(url);
      const providerId =
        completion.providerId ?? startingProviderIdRef.current ?? null;
      setStarting(null);
      if (!completion.success) {
        trackMcpError('OAuth flow completed with error', {
          action: 'completeOAuth',
          providerId: completion.providerId,
          completionMessage: completion.message,
        });
      } else {
        trackMcpEvent(MCP_TELEMETRY_EVENTS.connected, {
          providerId: completion.providerId,
        });
        trackTlonbotSettingUpdated({
          setting: 'connected_service',
          action: 'connected',
          provider: completion.providerId ?? undefined,
        });
        triggerHaptic('success');
      }
      emit({
        type: 'completed',
        providerId,
        success: completion.success,
        message: completion.message,
      });
      refreshStatus();
    },
    [emit, refreshStatus, setStarting]
  );

  useEffect(() => {
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleOAuthCompletion(initialUrl);
      }
    });
    const subscription = Linking.addEventListener('url', (event) => {
      handleOAuthCompletion(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleOAuthCompletion]);

  useEffect(() => {
    if (!startingProviderId) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      setStarting(null);
      emit({ type: 'returned', providerId: startingProviderId });
      refreshStatus();
    });

    return () => {
      subscription.remove();
    };
  }, [emit, refreshStatus, setStarting, startingProviderId]);

  const providers = useMemo(
    () => buildProviderRows(providerConfigs, status?.grants ?? []),
    [providerConfigs, status?.grants]
  );

  const connect = useCallback(
    async (providerId: string) => {
      if (!currentUserId || startingProviderId || disconnectingProviderId) {
        return;
      }

      setStarting(providerId);
      trackMcpEvent(MCP_TELEMETRY_EVENTS.initiatedOAuth, { providerId });
      try {
        const finalRedirectUrl = getFinalRedirectUrl();
        const response = await api.startTlawnOAuth(currentUserId, {
          providerId,
          finalRedirectUrl,
        });
        const openResult = await openOAuthUrl(
          response.authUrl,
          finalRedirectUrl
        );
        if (openResult.type === 'completed') {
          handleOAuthCompletion(openResult.url);
        } else if (openResult.type === 'canceled') {
          setStarting(null);
          emit({ type: 'canceled', providerId });
        }
      } catch (err) {
        trackMcpError('Failed to start OAuth flow', {
          action: 'startOAuth',
          providerId,
          error: err,
        });
        setStarting(null);
        emit({ type: 'start-failed', providerId });
      }
    },
    [
      currentUserId,
      disconnectingProviderId,
      emit,
      handleOAuthCompletion,
      setStarting,
      startingProviderId,
    ]
  );

  const disconnect = useCallback(
    async (providerId: string) => {
      if (!currentUserId || startingProviderId || disconnectingProviderId) {
        return;
      }

      setDisconnectingProviderId(providerId);
      try {
        await api.deleteTlawnOAuthGrant(currentUserId, providerId);
        trackMcpEvent(MCP_TELEMETRY_EVENTS.disconnected, { providerId });
        trackTlonbotSettingUpdated({
          setting: 'connected_service',
          action: 'disconnected',
          provider: providerId,
        });
        triggerHaptic('success');
        emit({ type: 'disconnected', providerId });
        await refreshStatus();
      } catch (err) {
        trackMcpError('Failed to disconnect OAuth provider', {
          action: 'disconnectOAuth',
          providerId,
          error: err,
        });
        emit({ type: 'disconnect-failed', providerId });
      } finally {
        if (isMounted.current) {
          setDisconnectingProviderId(null);
        }
      }
    },
    [
      currentUserId,
      disconnectingProviderId,
      emit,
      refreshStatus,
      startingProviderId,
    ]
  );

  return {
    providerConfigs,
    providers,
    status,
    hostingSessionUnavailable,
    initialLoading,
    refreshing,
    startingProviderId,
    busyProviderId: startingProviderId ?? disconnectingProviderId,
    refreshStatus,
    connect,
    disconnect,
  };
}
