import { poke } from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';

const logger = createDevLogger('notificationsApi', true);

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
  logger.trackEvent('Registered push notifications token with provider', {
    address,
    provider: NOTIFY_PROVIDER,
    service: NOTIFY_SERVICE,
  });
};
