import { Pressable } from 'react-native';
import { Spinner } from 'tamagui';

import { useConnectionStatus } from '../../features/top/useConnectionStatus';
import { useCurrentUserId } from '../contexts';
import { Icon, getStatusLabels } from '../utils';
import { ListItem } from './ListItem/ListItem';

export interface ConnectionStatusProps {
  contactId: string;
  onPress?: () => void;
  label?: string;
}


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
