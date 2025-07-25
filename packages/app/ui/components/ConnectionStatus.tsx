import { ConnectionState } from '@tloncorp/shared/api';
import { Pressable } from 'react-native';
import { Spinner } from 'tamagui';

import { useConnectionStatus } from '../../features/top/useConnectionStatus';
import { useCurrentUserId } from '../contexts';
import { Icon, IconType } from '../utils';
import { ListItem } from './ListItem/ListItem';

export interface ConnectionStatusProps {
  contactId: string;
  onPress?: () => void;
  label?: string;
}

export const getStatusLabels = (
  status: ConnectionState,
  contactId?: string,
  label?: string
): { title: string; subtitle: string; icon?: IconType } => {
  const shipName = contactId || 'peer node';
  const connectionLabel = label || 'Connected';

  switch (status) {
    case 'yes':
      return {
        title: connectionLabel,
        subtitle: `Connected to ${shipName}`,
        icon: 'Checkmark',
      };
    case 'crash':
      return {
        title: 'Failed',
        subtitle: `Status checker failed for ${shipName}`,
        icon: 'Close',
      };
    case 'no-data':
      return {
        title: 'Failed',
        subtitle: `No data received from ${shipName}`,
        icon: 'Close',
      };
    case 'no-dns':
      return {
        title: 'Failed',
        subtitle: `DNS failed for ${shipName}. Check your network connection`,
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
        subtitle: `No connection to ${shipName}'s sponsor node`,
        icon: 'Close',
      };
    case 'no-sponsor-miss':
      return {
        title: 'Disconnected',
        subtitle: `No connection between ${shipName} and their sponsor node`,
        icon: 'Close',
      };
    case 'no-their-galaxy':
      return {
        title: 'Disconnected',
        subtitle: `No connection to ${shipName}'s root node`,
        icon: 'Close',
      };
    case 'setting-up':
      return {
        title: 'Connecting...',
        subtitle: `Setting up connection to ${shipName}...`,
      };
    case 'trying-dns':
      return {
        title: 'Connecting...',
        subtitle: `Trying DNS for ${shipName}...`,
      };
    case 'trying-local':
      return {
        title: 'Connecting...',
        subtitle: `Trying our node to reach ${shipName}...`,
      };
    case 'trying-target':
      return {
        title: 'Connecting...',
        subtitle: `Trying to reach ${shipName}...`,
        icon: 'EyeOpen',
      };
    case 'trying-sponsor':
      return {
        title: 'Connecting...',
        subtitle: `Trying ${shipName}'s sponsor node(s)...`,
        icon: 'EyeOpen',
      };
    default:
      return {
        title: 'Connecting...',
        subtitle: `Connecting to ${shipName}...`,
      };
  }
};

export const ConnectionStatusComponent = ({
  contactId,
  onPress,
  label,
}: ConnectionStatusProps) => {
  const currentUserId = useCurrentUserId();
  const connectionStatus = useConnectionStatus(contactId);

  // Don't show connection status for current user
  if (currentUserId === contactId) {
    return null;
  }

  const loading = !connectionStatus || !connectionStatus.complete;
  const error = null; // Hook handles errors internally

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ListItem paddingHorizontal={'$2xl'}>
        <ListItem.MainContent>
          <ListItem.Title>
            {connectionStatus
              ? getStatusLabels(connectionStatus.status, contactId, label)?.title
              : 'Checking connection...'}
          </ListItem.Title>
          <ListItem.Subtitle>
            {connectionStatus
              ? error ??
                getStatusLabels(connectionStatus.status, contactId, label)?.subtitle
              : `Initializing connection check to ${contactId}...`}
          </ListItem.Subtitle>
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
            {getStatusLabels(connectionStatus.status, contactId, label).icon ? (
              <Icon
                type={
                  getStatusLabels(connectionStatus.status, contactId, label).icon ??
                  'Placeholder'
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
