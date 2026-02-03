import {
  ConnectionState,
  ConnectionStatus as ConnectionStatusType,
} from '@tloncorp/shared/api';
import { Text } from '@tloncorp/ui';
import { useMemo } from 'react';
import { Pressable } from 'react-native';
import { ColorTokens, Spinner, XStack } from 'tamagui';

import {
  ConnectivityCheckOptions,
  useShipConnectionStatus,
} from '../../features/top/useShipConnectionStatus';
import { Icon, IconType } from '../utils';
import { Badge, BadgeType } from './Badge';
import { ListItem } from './ListItem/ListItem';

export interface ConnectionStatusProps {
  contactId: string;
  type?: 'indicator' | 'indicator-with-text' | 'badge' | 'list-item';
  options?: ConnectivityCheckOptions;
  onPress?: () => void;
}

export const getStatusLabels = (
  status: ConnectionState
): {
  title: string;
  subtitle: string;
  color: ColorTokens | undefined;
  icon?: IconType;
} => {
  switch (status) {
    case 'yes':
      return {
        title: 'Connected',
        subtitle: 'Connected to peer node',
        icon: 'Checkmark',
        color: '$green',
      };
    case 'crash':
      return {
        title: 'Failed',
        subtitle: 'Status checker failed',
        icon: 'Close',
        color: '$red',
      };
    case 'no-data':
      return {
        title: 'Failed',
        subtitle: 'No data received from status checker',
        icon: 'Close',
        color: '$gray300',
      };
    case 'no-dns':
      return {
        title: 'Failed',
        subtitle: 'DNS failed. Check your network connection',
        icon: 'Close',
        color: '$red',
      };
    case 'no-our-planet':
      return {
        title: 'Disconnected',
        subtitle: 'Your moon is disconnected from your planet. Is it running?',
        icon: 'Close',
        color: '$red',
      };
    case 'no-our-galaxy':
      return {
        title: 'Disconnected',
        subtitle: 'No connection to our root node',
        icon: 'Close',
        color: '$red',
      };
    case 'no-sponsor-hit':
      return {
        title: 'Disconnected',
        subtitle: "No connection to peer's sponsor node",
        icon: 'Close',
        color: '$red',
      };
    case 'no-sponsor-miss':
      return {
        title: 'Disconnected',
        subtitle: 'No connection between peer and their sponsor node',
        icon: 'Close',
        color: '$red',
      };
    case 'no-their-galaxy':
      return {
        title: 'Disconnected',
        subtitle: "No connection to peer's root node",
        icon: 'Close',
        color: '$red',
      };
    case 'setting-up':
      return {
        title: 'Connecting...',
        subtitle: 'Setting up...',
        color: '$yellow',
      };
    case 'trying-dns':
      return {
        title: 'Connecting...',
        subtitle: 'Trying DNS...',
        color: '$yellow',
      };
    case 'trying-local':
      return {
        title: 'Connecting...',
        subtitle: 'Trying our node...',
        color: '$yellow',
      };
    case 'trying-target':
      return {
        title: 'Connecting...',
        subtitle: 'Trying peer node...',
        icon: 'EyeOpen',
        color: '$yellow',
      };
    case 'trying-sponsor':
      return {
        title: 'Connecting...',
        subtitle: 'Trying sponsor node(s)...',
        icon: 'EyeOpen',
        color: '$yellow',
      };
    default:
      return {
        title: 'Connecting...',
        subtitle: 'Connecting...',
        color: '$yellow',
      };
  }
};

function getSimpleStatusLabel(status: ConnectionStatusType): {
  label: string;
  type: BadgeType;
  color: ColorTokens;
} {
  if (!status.complete) {
    switch (status.status) {
      case 'setting-up':
        return {
          label: 'Checking...',
          type: 'tertiary',
          color: '$tertiaryText',
        };
      case 'trying-dns':
      case 'trying-sponsor':
        return {
          label: 'Checking network...',
          type: 'tertiary',
          color: '$tertiaryText',
        };
      default:
        return {
          label: 'Checking host status...',
          type: 'tertiary',
          color: '$tertiaryText',
        };
    }
  }

  switch (status.status) {
    case 'yes':
      return { label: 'Online', type: 'positive', color: '$green' };
    default:
      return { label: 'Offline', type: 'warning', color: '$orange' };
  }
}

export const ConnectionStatus = ({
  contactId,
  type = 'indicator',
  options,
  onPress,
}: ConnectionStatusProps) => {
  const connectionStatus = useShipConnectionStatus(contactId, options);

  if (type === 'badge') {
    return <ConnectionIndicatorBadge status={connectionStatus} />;
  }

  if (type === 'list-item') {
    return (
      <ConnectionIndicatorListItem
        status={connectionStatus.status}
        onPress={onPress}
      />
    );
  }

  return (
    <ConnectionIndicator
      status={connectionStatus}
      onPress={onPress}
      showText={type === 'indicator-with-text'}
    />
  );
};

export function ConnectionIndicator({
  status,
  showText = true,
  onPress,
}: {
  status: ConnectionStatusType;
  showText?: boolean;
  onPress?: () => void;
}) {
  const labels = useMemo(() => getSimpleStatusLabel(status), [status]);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <XStack alignItems="center">
        <Icon type="Record" color={labels.color} size="$l" />
        {showText && (
          <Text size="$label/m" color="$tertiaryText">
            {labels.label}
          </Text>
        )}
      </XStack>
    </Pressable>
  );
}

export function ConnectionIndicatorBadge({
  status,
}: {
  status: ConnectionStatusType;
}) {
  const badge = useMemo(() => {
    if (!status.complete) {
      switch (status.status) {
        case 'setting-up':
          return { label: 'Setting up...', type: 'tertiary' };
        case 'trying-dns':
        case 'trying-sponsor':
          return { label: 'Checking network...', type: 'tertiary' };
        default:
          return { label: 'Checking host status...', type: 'tertiary' };
      }
    } else {
      switch (status.status) {
        case 'yes':
          return { label: 'Online', type: 'positive' };
        default:
          return { label: 'Offline', type: 'warning' };
      }
    }
  }, [status]);

  return <Badge text={badge.label} type={badge.type as BadgeType} />;
}

export function ConnectionIndicatorListItem({
  status,
  onPress,
}: {
  status: ConnectionState;
  onPress?: () => void;
}) {
  const labels = useMemo(() => getStatusLabels(status), [status]);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ListItem paddingHorizontal={'$2xl'}>
        <ListItem.MainContent>
          <ListItem.Title>{labels.title}</ListItem.Title>
          <ListItem.Subtitle>{labels.subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
        <ListItem.EndContent>
          {labels.icon ? <Icon type={labels.icon} /> : <Spinner size="small" />}
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

export default ConnectionStatus;
