import * as store from '@tloncorp/shared/store';

import {
  getNotificationLevelContext,
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
  const currentLevel = channel?.id ? currentChannelVolume : currentGroupVolume;

  const options = useNotificationLevelOptions({
    includeLoud: true,
    shortDescriptions: true,
    context: getNotificationLevelContext(channel),
  });

  return { currentLevel, options, updateVolume };
}
