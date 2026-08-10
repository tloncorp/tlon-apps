import { poke } from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import { Platform } from 'react-native';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../constants';

const logger = createDevLogger('notificationsApi', true);

/**
 * Notification kinds this build knows how to render, declared to the ship on
 * every registration. `%notify` withholds a push whose kind requires a
 * capability the device hasn't declared, since iOS can't suppress an alert
 * once APNs has delivered it — see `gated-kinds` in `desk/app/notify.hoon`.
 *
 * Empty because no kind is gated yet. When adding a kind that older clients
 * can't render, add its tag here in the same change that teaches
 * `renderActivityEventPreview` (packages/scripts) to handle it.
 */
export const PUSH_CAPABILITIES: string[] = [];

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
        caps: PUSH_CAPABILITIES,
      },
    },
  });
  logger.trackEvent('Registered push notifications token with provider', {
    address,
    provider: NOTIFY_PROVIDER,
    service: NOTIFY_SERVICE,
    caps: PUSH_CAPABILITIES,
  });
};
