import {
  ConnectionState,
  ConnectionStatus,
  checkConnectionStatus,
  getLastConnectionStatus,
} from '@tloncorp/shared/api';
import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Spinner } from 'tamagui';

import { Icon, IconType } from '../utils';
import { ListItem } from './ListItem/ListItem';

export interface ConnectionStatusProps {
  contactId: string;
  autoCheck?: boolean;
  mockStatus?: ConnectionStatus;
  onPress?: () => void;
}

export const getStatusLabels = (
  status: ConnectionState
): { title: string; subtitle: string; icon?: IconType } => {
  switch (status) {
    case 'yes':
      return {
        title: 'Connected',
        subtitle: 'Connected to peer node',
        icon: 'Checkmark',
      };
    case 'crash':
      return {
        title: 'Failed',
        subtitle: 'Status checker failed',
        icon: 'Close',
      };
    case 'no-data':
      return {
        title: 'Failed',
        subtitle: 'No data received from status checker',
        icon: 'Close',
      };
    case 'no-dns':
      return {
        title: 'Failed',
        subtitle: 'DNS failed. Check your network connection',
        icon: 'Close',
      };
    case 'no-our-planet':
      return {
        title: 'Disconnected',
        subtitle: 'Your moon is disconnected from your planet. Is it running?',
        icon: 'Close',
      };
    case 'no-our-galaxy':
      return {
        title: 'Disconnected',
        subtitle: 'No connection to our root node',
        icon: 'Close',
      };
    case 'no-sponsor-hit':
      return {
        title: 'Disconnected',
        subtitle: "No connection to peer's sponsor node",
        icon: 'Close',
      };
    case 'no-sponsor-miss':
      return {
        title: 'Disconnected',
        subtitle: 'No connection between peer and their sponsor node',
        icon: 'Close',
      };
    case 'no-their-galaxy':
      return {
        title: 'Disconnected',
        subtitle: "No connection to peer's root node",
        icon: 'Close',
      };
    case 'setting-up':
      return {
        title: 'Connecting...',
        subtitle: 'Setting up...',
      };
    case 'trying-dns':
      return {
        title: 'Connecting...',
        subtitle: 'Trying DNS...',
      };
    case 'trying-local':
      return {
        title: 'Connecting...',
        subtitle: 'Trying our node...',
      };
    case 'trying-target':
      return {
        title: 'Connecting...',
        subtitle: 'Trying peer node...',
        icon: 'EyeOpen',
      };
    case 'trying-sponsor':
      return {
        title: 'Connecting...',
        subtitle: 'Trying sponsor node(s)...',
        icon: 'EyeOpen',
      };
    default:
      return {
        title: 'Connecting...',
        subtitle: 'Connecting...',
      };
  }
};

export const ConnectionStatusComponent = ({
  contactId,
  autoCheck = true,
  mockStatus,
  onPress,
}: ConnectionStatusProps) => {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(mockStatus ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMockData = useCallback((mockStatus: ConnectionStatus) => {
    setConnectionStatus(mockStatus);
    setLoading(!mockStatus.complete);
    setError(null);
  }, []);

  const loadLastStatus = useCallback(async () => {
    // Skip API call if we have mock data
    if (mockStatus) {
      loadMockData(mockStatus);
      return;
    }
    // Otherwise, load the last known status
    try {
      setLoading(true);
      setError(null);
      const status = await getLastConnectionStatus(contactId);
      setConnectionStatus(status);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load last known status'
      );
    } finally {
      setLoading(false);
    }
  }, [contactId, mockStatus, loadMockData]);

  const runCheck = useCallback(async () => {
    // Skip API call if we have mock data
    if (mockStatus) {
      loadMockData(mockStatus);
      return;
    }
    // Otherwise, run the check
    try {
      setLoading(true);
      setError(null);
      await checkConnectionStatus(contactId, (status: ConnectionStatus) => {
        setConnectionStatus(status);
        if (status.complete) {
          setLoading(false);
        }
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check connection status'
      );
      setLoading(false);
    }
  }, [contactId, mockStatus, loadMockData]);

  useEffect(() => {
    // Skip API call if we have mock data
    if (mockStatus) {
      loadMockData(mockStatus);
      return;
    }
    // Otherwise, run the check
    if (autoCheck) {
      runCheck();
    } else {
      loadLastStatus();
    }
  }, [autoCheck, mockStatus, runCheck, loadLastStatus, loadMockData]);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ListItem>
        <ListItem.MainContent>
          {connectionStatus && (
            <>
              <ListItem.Title>
                {getStatusLabels(connectionStatus.status)?.title}
              </ListItem.Title>
              <ListItem.Subtitle>
                {error ?? getStatusLabels(connectionStatus.status)?.subtitle}
              </ListItem.Subtitle>
            </>
          )}
        </ListItem.MainContent>
        {loading && (
          <ListItem.EndContent>
            <Spinner size="small" />
          </ListItem.EndContent>
        )}
        {error && (
          <ListItem.EndContent>
            <Icon type="Close" />
          </ListItem.EndContent>
        )}
        {!loading && !error && connectionStatus && (
          <ListItem.EndContent>
            {getStatusLabels(connectionStatus.status).icon ? (
              <Icon
                type={
                  getStatusLabels(connectionStatus.status).icon ?? 'Placeholder'
                }
              />
            ) : (
              <Spinner size="small" />
            )}
          </ListItem.EndContent>
        )}
      </ListItem>
    </Pressable>
  );
};

export default ConnectionStatusComponent;
