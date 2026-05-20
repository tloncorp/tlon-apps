import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import { APP_SCHEME } from '../../constants';
import { useShip } from '../../contexts/ship';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import {
  BotSettingsCompletionNotice,
  BotSettingsProviderRow,
  BotSettingsScreenView,
  isWeb,
} from '../../ui';
import { MCP_OAUTH_PROVIDERS, McpOAuthProvider } from './mcpOAuthProviders';

type Props = NativeStackScreenProps<RootStackParamList, 'BotSettings'>;

type OAuthCompletion = {
  message: string;
  providerId: string | null;
  success: boolean;
};

const logger = createDevLogger('botSettings', false);
const WEB_COMPLETION_PARAM = 'mcp_oauth';
const COMPLETION_PATH = 'mcp-oauth/complete';

export function BotSettingsScreen(props: Props) {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const { ship } = useShip();
  const [shipId, setShipId] = useState<string | null>(
    ship ? ship.replace(/^~/, '') : null
  );
  const [status, setStatus] = useState<api.TlawnOAuthStatus | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionNotice, setCompletionNotice] =
    useState<BotSettingsCompletionNotice | null>(null);
  const [startingProviderId, setStartingProviderId] = useState<string | null>(
    null
  );
  const handledCompletionUrls = useRef(new Set<string>());
  const isMounted = useRef(true);

  const refreshStatus = useCallback(async () => {
    if (!shipId) {
      setInitialLoading(false);
      setError('No hosted ship is available.');
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const nextStatus = await api.getTlawnOAuthStatus(shipId);
      if (isMounted.current) {
        setStatus(nextStatus);
      }
    } catch (err) {
      logger.trackError('Failed to load OAuth status', { error: err });
      if (isMounted.current) {
        setError(getErrorMessage(err, 'Could not load MCP server status.'));
      }
    } finally {
      if (isMounted.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [shipId]);

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
      setCompletionNotice({
        message: completion.message,
        tone: completion.success ? 'success' : 'error',
      });
      refreshStatus();
    },
    [refreshStatus]
  );

  useEffect(() => {
    if (isWeb) {
      const completion = parseOAuthCompletionUrl(window.location.href);
      if (completion) {
        setCompletionNotice({
          message: completion.message,
          tone: completion.success ? 'success' : 'error',
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
  }, [handleOAuthCompletion]);

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
    () => buildProviderRows(MCP_OAUTH_PROVIDERS, status?.grants ?? []),
    [status?.grants]
  );

  const handleConnectProvider = useCallback(
    async (providerId: string) => {
      if (!shipId || startingProviderId) {
        return;
      }

      setStartingProviderId(providerId);
      setError(null);
      setCompletionNotice(null);
      try {
        const response = await api.startTlawnOAuth(shipId, {
          providerId,
          finalRedirectUrl: getFinalRedirectUrl(),
        });
        await openAuthUrl(response.authUrl);
      } catch (err) {
        logger.trackError('Failed to start OAuth flow', { error: err });
        setStartingProviderId(null);
        setError(getErrorMessage(err, 'Could not start OAuth.'));
      }
    },
    [shipId, startingProviderId]
  );

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  return (
    <BotSettingsScreenView
      available={status?.available ?? false}
      completionNotice={completionNotice}
      error={error}
      initialLoading={initialLoading}
      onBackPressed={handleBack}
      onConnectProvider={handleConnectProvider}
      onRefresh={refreshStatus}
      providers={providers}
      refreshing={refreshing}
      startingProviderId={startingProviderId}
    />
  );
}

function buildProviderRows(
  providers: McpOAuthProvider[],
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
      grantSummary: grant ? describeGrant(grant) : '',
      id: provider.id,
      scopesSummary: describeScopes(provider.scopes),
      status,
      upstreamSummary: describeUpstream(provider),
    };
  });
}

function describeUpstream(provider: McpOAuthProvider) {
  return provider.suggestedUpstream.mode === 'proxy'
    ? `${provider.suggestedUpstream.name} remote MCP`
    : `${provider.suggestedUpstream.name} OpenAPI tools`;
}

function describeGrant(grant: api.TlawnOAuthGrant) {
  const pieces = [
    grant.hasRefreshToken ? 'Refresh token saved' : 'No refresh token',
    describeScopes(grant.scopes),
  ].filter(Boolean);

  return pieces.join(' • ');
}

function describeScopes(scopes: string) {
  const scopeCount = scopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean).length;

  if (scopeCount === 0) {
    return 'No scopes requested';
  }

  return `${scopeCount} ${scopeCount === 1 ? 'scope' : 'scopes'}`;
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
    const error =
      url.searchParams.get('error') ?? url.searchParams.get('message');
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

    const success = !error && status !== 'error' && status !== 'failed';
    const providerLabel = providerId ? ` for ${providerId}` : '';
    const message = success
      ? `Connection complete${providerLabel}.`
      : error || `Connection failed${providerLabel}.`;

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
