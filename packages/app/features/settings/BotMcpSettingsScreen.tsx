import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { triggerHaptic, useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { BotSettingsScreenView } from '../../ui';
import {
  GENERIC_ERROR_MESSAGE,
  MCP_TELEMETRY_EVENTS,
  TOAST_BOTTOM_OFFSET,
  buildProviderRows,
  getFinalRedirectUrl,
  parseOAuthCompletionUrl,
  trackMcpError,
  trackMcpEvent,
} from './botMcpSettingsHelpers';

type Props = NativeStackScreenProps<RootStackParamList, 'BotMcpSettings'>;

export function BotMcpSettingsScreen(props: Props) {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const showToast = useToast();
  const showMcpToast = useCallback(
    (options: { duration?: number; message: string }) => {
      showToast({ ...options, bottomOffset: TOAST_BOTTOM_OFFSET });
    },
    [showToast]
  );
  const currentUserId = useCurrentUserId();
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
    if (!currentUserId) {
      setInitialLoading(false);
      trackMcpError('OAuth status requested without current user', {
        action: 'loadStatus',
      });
      showMcpToast({ message: GENERIC_ERROR_MESSAGE });
      return;
    }

    setRefreshing(true);
    try {
      const [nextProviders, nextStatus] = await Promise.all([
        api.getTlawnOAuthProviders(),
        api.getTlawnOAuthStatus(currentUserId),
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
        showMcpToast({ message: GENERIC_ERROR_MESSAGE });
      }
    } finally {
      if (isMounted.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUserId, showMcpToast]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
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
        triggerHaptic('success');
      }
      showMcpToast({
        message: completion.success
          ? completion.message
          : GENERIC_ERROR_MESSAGE,
      });
      refreshStatus();
    },
    [refreshStatus, showMcpToast]
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
  }, [handleOAuthCompletion, showMcpToast]);

  useEffect(() => {
    if (!startingProviderId) {
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
      if (!currentUserId || startingProviderId || disconnectingProviderId) {
        return;
      }

      setStartingProviderId(providerId);
      trackMcpEvent(MCP_TELEMETRY_EVENTS.initiatedOAuth, { providerId });
      try {
        const response = await api.startTlawnOAuth(currentUserId, {
          providerId,
          finalRedirectUrl: getFinalRedirectUrl(),
        });
        await Linking.openURL(response.authUrl);
      } catch (err) {
        trackMcpError('Failed to start OAuth flow', {
          action: 'startOAuth',
          providerId,
          error: err,
        });
        setStartingProviderId(null);
        showMcpToast({ message: GENERIC_ERROR_MESSAGE });
      }
    },
    [currentUserId, disconnectingProviderId, showMcpToast, startingProviderId]
  );

  const handleDisconnectProvider = useCallback(
    async (providerId: string) => {
      if (!currentUserId || startingProviderId || disconnectingProviderId) {
        return;
      }

      setDisconnectingProviderId(providerId);
      try {
        await api.deleteTlawnOAuthGrant(currentUserId, providerId);
        trackMcpEvent(MCP_TELEMETRY_EVENTS.disconnected, { providerId });
        triggerHaptic('success');
        showMcpToast({ message: 'Connection disconnected.' });
        await refreshStatus();
      } catch (err) {
        trackMcpError('Failed to disconnect OAuth provider', {
          action: 'disconnectOAuth',
          providerId,
          error: err,
        });
        showMcpToast({ message: GENERIC_ERROR_MESSAGE });
      } finally {
        if (isMounted.current) {
          setDisconnectingProviderId(null);
        }
      }
    },
    [
      currentUserId,
      disconnectingProviderId,
      refreshStatus,
      showMcpToast,
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
