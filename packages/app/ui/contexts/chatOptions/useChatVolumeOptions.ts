import * as store from '@tloncorp/shared/store';

import {
  getNotificationLevelContext,
  normalizeLevelToOptions,
  useNotificationLevelOptions,
} from '../../components/NotificationLevelSelector';
import { useChatOptions } from './useChatOptions';

// Builds the notification-volume radio options for the chat currently in the
// ChatOptions context, along with its current level and the volume setter.
// Shared by the notifications action sheet (ChatOptionsSheet) and the
// full-screen volume menu (ChatVolumeScreen) so they stay in sync.
export function useChatVolumeOptions() {
  const { updateVolume, group, channel } = useChatOptions();

  const { data: currentChannelVolume } = store.useChannelVolumeLevel(
    channel?.id ?? ''
  );
  const { data: currentGroupVolume } = store.useGroupVolumeLevel(
    group?.id ?? ''
  );
  const rawLevel = channel?.id ? currentChannelVolume : currentGroupVolume;

  const options = useNotificationLevelOptions({
    includeLoud: true,
    shortDescriptions: true,
    context: getNotificationLevelContext(channel),
  });

  // A stored level not offered by this menu (e.g. a legacy/inherited 'soft' on
  // a DM) would otherwise leave no row checked.
  const currentLevel = normalizeLevelToOptions(rawLevel, options);

  return { currentLevel, options, updateVolume };
}
