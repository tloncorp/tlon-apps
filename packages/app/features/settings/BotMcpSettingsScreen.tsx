import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { useHandleLogout } from '../../hooks/useHandleLogout';
import { useResetDb } from '../../hooks/useResetDb';
import { RootStackParamList } from '../../navigation/types';
import { BotSettingsScreenView } from '../../ui';
import {
  TOAST_BOTTOM_OFFSET,
  connectionEventMessage,
} from './botMcpSettingsHelpers';
import { McpConnectionEvent, useMcpConnections } from './useMcpConnections';

type Props = NativeStackScreenProps<RootStackParamList, 'BotMcpSettings'>;

export function BotMcpSettingsScreen(props: Props) {
  const resetDb = useResetDb();
  const handleLogout = useHandleLogout({ resetDb });
  const showToast = useToast();
  const handleConnectionEvent = useCallback(
    (event: McpConnectionEvent) => {
      const message = connectionEventMessage(event);
      if (message) {
        showToast({ message, bottomOffset: TOAST_BOTTOM_OFFSET });
      }
    },
    [showToast]
  );
  const connections = useMcpConnections({ onEvent: handleConnectionEvent });
  const { connect, initialLoading, providers, refreshStatus, status } =
    connections;
  const requestedProviders = useRef(new Set<string>());
  const isMounted = useRef(true);

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

  useEffect(() => {
    const providerId = props.route.params?.providerId;
    if (!providerId || initialLoading || !status) {
      return;
    }

    const provider = providers.find((candidate) => candidate.id === providerId);
    if (
      !provider ||
      !status.available ||
      provider.status === 'connected' ||
      requestedProviders.current.has(providerId)
    ) {
      props.navigation.setParams({ providerId: undefined });
      return;
    }

    requestedProviders.current.add(providerId);
    props.navigation.setParams({ providerId: undefined });
    void connect(providerId).finally(() => {
      requestedProviders.current.delete(providerId);
    });
  }, [
    connect,
    initialLoading,
    props.navigation,
    props.route.params?.providerId,
    providers,
    status,
  ]);

  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  return (
    <BotSettingsScreenView
      available={status?.available ?? false}
      initialLoading={initialLoading}
      onBackPressed={handleBack}
      onConnectProvider={connect}
      onDisconnectProvider={connections.disconnect}
      onRefresh={refreshStatus}
      providers={providers}
      refreshing={connections.refreshing}
      busyProviderId={connections.busyProviderId}
      showUnavailableNotice={
        connections.hostingSessionUnavailable || status?.available === false
      }
    />
  );
}
