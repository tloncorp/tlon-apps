import { client } from '@tloncorp/shared/dist/api';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';

export const connectNotifyProvider = async (address: string) => {
  await client.poke({
    app: 'notify',
    mark: 'notify-client-action',
    json: {
      'connect-provider-with-binding': {
        who: NOTIFY_PROVIDER,
        service: NOTIFY_SERVICE,
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
