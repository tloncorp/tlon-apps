import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import { APP_SCHEME } from '../../constants';
import { useShip } from '../../contexts/ship';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { BotSettingsProviderRow, BotSettingsScreenView, isWeb } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'BotMcpSettings'>;

type OAuthCompletion = {
  message: string;
  providerId: string | null;
  success: boolean;
};

const logger = createDevLogger('botSettings', false);
const WEB_COMPLETION_PARAM = 'mcp_oauth';
const COMPLETION_PATH = 'mcp-oauth/complete';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const MCP_TELEMETRY_EVENTS = {
  initiatedOAuth: 'Tlonbot MCP: Initiated OAuth',
  connected: 'Tlonbot MCP: Connected',
  disconnected: 'Tlonbot MCP: Disconnected',
  error: 'Tlonbot MCP: Error',
} as const;

export function BotMcpSettingsScreen(props: Props) {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const showToast = useToast();
  const { ship } = useShip();
  const [shipId, setShipId] = useState<string | null>(
    ship ? ship.replace(/^~/, '') : null
  );
  const [providerConfigs, setProviderConfigs] = useState<
    api.TlawnOAuthProvider[]
  >([]);
  const [status, setStatus] = useState<api.TlawnOAuthStatus | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingProviderId, setStartingProviderId] = useState<string | null>(
    null
  );
  const [disconnectingProviderId, setDisconnectingProviderId] = useState<
    string | null
  >(null);
  const handledCompletionUrls = useRef(new Set<string>());
  const isMounted = useRef(true);

  const refreshStatus = useCallback(async () => {
    if (!shipId) {
      setInitialLoading(false);
      trackMcpError('OAuth status requested without hosted ship', {
        action: 'loadStatus',
      });
      showToast({ message: GENERIC_ERROR_MESSAGE });
      return;
    }

    setRefreshing(true);
    try {
      const [nextProviders, nextStatus] = await Promise.all([
        api.getTlawnOAuthProviders(),
        api.getTlawnOAuthStatus(shipId),
      ]);
      if (isMounted.current) {
        setProviderConfigs(nextProviders);
        setStatus(nextStatus);
      }
    } catch (err) {
      trackMcpError('Failed to load OAuth status', {
        action: 'loadStatus',
        error: err,
      });
      if (isMounted.current) {
        showToast({ message: GENERIC_ERROR_MESSAGE });
      }
    } finally {
      if (isMounted.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [shipId, showToast]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (ship) {
      setShipId(ship.replace(/^~/, ''));
    }
  }, [ship]);

  useEffect(() => {
    async function initializeShip() {
      const hostedShipId = await db.hostedUserNodeId.getValue();
      if (isMounted.current && hostedShipId) {
        setShipId(hostedShipId.replace(/^~/, ''));
      }
    }

    initializeShip();
  }, []);

  useEffect(() => {
    async function checkHostingSession() {
      const isExpired = await db.hostingAuthExpired.getValue();
      if (!isMounted.current || !isExpired) {
        return;
      }
      Alert.alert(
        'Logout Required',
        "To access bot settings, you'll need to log back in again.",
        [
          {
            text: 'Cancel',
            onPress: () => props.navigation.goBack(),
            style: 'cancel',
          },
          {
            text: 'Logout',
            onPress: handleLogout,
          },
        ]
      );
    }

    checkHostingSession();
  }, [handleLogout, props.navigation]);

  useFocusEffect(
    useCallback(() => {
      refreshStatus();
    }, [refreshStatus])
  );

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
      setStartingProviderId(null);
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
      }
      showToast({
        message: completion.success
          ? completion.message
          : GENERIC_ERROR_MESSAGE,
      });
      refreshStatus();
    },
    [refreshStatus, showToast]
  );

  useEffect(() => {
    if (isWeb) {
      const completion = parseOAuthCompletionUrl(window.location.href);
      if (completion) {
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
        }
        showToast({
          message: completion.success
            ? completion.message
            : GENERIC_ERROR_MESSAGE,
        });
        clearWebCompletionParams();
      }
      return;
    }

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
  }, [handleOAuthCompletion, showToast]);

  useEffect(() => {
    if (isWeb || !startingProviderId) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      setStartingProviderId(null);
      refreshStatus();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshStatus, startingProviderId]);

  const providers = useMemo(
    () => buildProviderRows(providerConfigs, status?.grants ?? []),
    [providerConfigs, status?.grants]
  );

  const handleConnectProvider = useCallback(
    async (providerId: string) => {
      if (!shipId || startingProviderId || disconnectingProviderId) {
        return;
      }

      setStartingProviderId(providerId);
      trackMcpEvent(MCP_TELEMETRY_EVENTS.initiatedOAuth, { providerId });
      try {
        const response = await api.startTlawnOAuth(shipId, {
          providerId,
          finalRedirectUrl: getFinalRedirectUrl(),
        });
        await openAuthUrl(response.authUrl);
      } catch (err) {
        trackMcpError('Failed to start OAuth flow', {
          action: 'startOAuth',
          providerId,
          error: err,
        });
        setStartingProviderId(null);
        showToast({ message: GENERIC_ERROR_MESSAGE });
      }
    },
    [disconnectingProviderId, shipId, showToast, startingProviderId]
  );

  const handleDisconnectProvider = useCallback(
    async (providerId: string) => {
      if (!shipId || startingProviderId || disconnectingProviderId) {
        return;
      }

      setDisconnectingProviderId(providerId);
      try {
        await api.deleteTlawnOAuthGrant(shipId, providerId);
        trackMcpEvent(MCP_TELEMETRY_EVENTS.disconnected, { providerId });
        showToast({ message: 'Connection disconnected.' });
        await refreshStatus();
      } catch (err) {
        trackMcpError('Failed to disconnect OAuth provider', {
          action: 'disconnectOAuth',
          providerId,
          error: err,
        });
        showToast({ message: GENERIC_ERROR_MESSAGE });
      } finally {
        if (isMounted.current) {
          setDisconnectingProviderId(null);
        }
      }
    },
    [
      disconnectingProviderId,
      refreshStatus,
      shipId,
      showToast,
      startingProviderId,
    ]
  );

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const busyProviderId = startingProviderId ?? disconnectingProviderId;

  return (
    <BotSettingsScreenView
      available={status?.available ?? false}
      initialLoading={initialLoading}
      onBackPressed={handleBack}
      onConnectProvider={handleConnectProvider}
      onDisconnectProvider={handleDisconnectProvider}
      onRefresh={refreshStatus}
      providers={providers}
      refreshing={refreshing}
      busyProviderId={busyProviderId}
      showUnavailableNotice={status?.available === false}
    />
  );
}

function buildProviderRows(
  providers: api.TlawnOAuthProvider[],
  grants: api.TlawnOAuthGrant[]
): BotSettingsProviderRow[] {
  const grantsByProvider = new Map(
    grants.map((grant) => [grant.provider.toLowerCase(), grant])
  );

  return providers.map((provider) => {
    const grant = grantsByProvider.get(provider.id.toLowerCase()) ?? null;
    const status =
      grant?.connected && !grant.expired
        ? 'connected'
        : grant
          ? 'expired'
          : 'not-connected';

    return {
      displayName: provider.displayName,
      id: provider.id,
      status,
    };
  });
}

function getFinalRedirectUrl() {
  if (isWeb && typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set(WEB_COMPLETION_PARAM, 'complete');
    clearOAuthSearchParams(url);
    return url.toString();
  }

  return `${APP_SCHEME}://${COMPLETION_PATH}`;
}

async function openAuthUrl(authUrl: string) {
  if (isWeb && typeof window !== 'undefined') {
    window.location.assign(authUrl);
    return;
  }

  await Linking.openURL(authUrl);
}

function parseOAuthCompletionUrl(urlString: string): OAuthCompletion | null {
  try {
    const url = new URL(urlString);
    const providerId = url.searchParams.get('provider');
    const status =
      url.searchParams.get('status') ?? url.searchParams.get('result');
    const error = url.searchParams.get('error');
    const callbackMessage = url.searchParams.get('message');
    const nativePath = [url.host, url.pathname.replace(/^\//, '')]
      .filter(Boolean)
      .join('/');
    const isNativeCompletion =
      url.protocol.replace(':', '') === APP_SCHEME &&
      nativePath === COMPLETION_PATH;
    const isWebCompletion =
      url.searchParams.get(WEB_COMPLETION_PARAM) === 'complete';

    if (!isNativeCompletion && !isWebCompletion) {
      return null;
    }

    const normalizedStatus = status?.toLowerCase();
    const success =
      !error && normalizedStatus !== 'error' && normalizedStatus !== 'failed';
    const providerLabel = providerId ? ` for ${providerId}` : '';
    const message = success
      ? callbackMessage || `Connection complete${providerLabel}.`
      : error || callbackMessage || `Connection failed${providerLabel}.`;

    return { message, providerId, success };
  } catch {
    return null;
  }
}

function clearWebCompletionParams() {
  if (!isWeb || typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete(WEB_COMPLETION_PARAM);
  clearOAuthSearchParams(url);
  window.history.replaceState(null, '', url.toString());
}

function clearOAuthSearchParams(url: URL) {
  url.searchParams.delete('status');
  url.searchParams.delete('result');
  url.searchParams.delete('error');
  url.searchParams.delete('message');
  url.searchParams.delete('provider');
}

function trackMcpEvent(
  eventName: (typeof MCP_TELEMETRY_EVENTS)[keyof typeof MCP_TELEMETRY_EVENTS],
  properties: Record<string, unknown> = {}
) {
  logger.trackEvent(eventName, compactTelemetryProperties(properties));
}

function trackMcpError(
  message: string,
  properties: Record<string, unknown> = {}
) {
  logger.trackError(message, properties);
  trackMcpEvent(MCP_TELEMETRY_EVENTS.error, {
    ...properties,
    errorMessage: message,
  });
}

function compactTelemetryProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, serializeTelemetryValue(value)])
  );
}

function serializeTelemetryValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      details: 'details' in value ? value.details : undefined,
      message: value.message,
      name: value.name,
    };
  }

  return value;
}
