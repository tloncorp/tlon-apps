import { poke } from '@tloncorp/shared/dist/api/urbit';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';

export const connectNotifyProvider = async (address: string) => {
  await poke({
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
  console.debug(
    'Registered push notifications token with provider:',
    NOTIFY_PROVIDER,
    NOTIFY_SERVICE
  );
};
