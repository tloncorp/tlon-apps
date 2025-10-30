import { poke } from '@tloncorp/shared/api';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';

export const connectNotifyProvider = async (address: string) => {
  await poke({
    app: 'notify',
    mark: 'notify-client-action',
    json: {
      'connect-provider-with-binding': {
        who: 'wannec-dozzod-marnus',
        service: 'tlon-preview-release',
        address,
        binding: Platform.OS === 'android' ? 'fcm' : 'apn',
      },
    },
  });
  console.log(
    'Registered push notifications token with provider:',
    address,
    NOTIFY_PROVIDER,
    NOTIFY_SERVICE
  );
};
