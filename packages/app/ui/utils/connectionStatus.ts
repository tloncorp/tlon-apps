import { ConnectionState } from '@tloncorp/shared/api';
import { IconType } from './index';

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