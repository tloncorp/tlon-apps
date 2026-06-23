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
  const baseVolume = store.useBaseVolumeLevel();
  const rawLevel = channel?.id ? currentChannelVolume : currentGroupVolume;

  const options = useNotificationLevelOptions({
    includeLoud: true,
    shortDescriptions: true,
    context: getNotificationLevelContext(channel),
  });

  // 'default' means "inherit from base" (e.g. after unmuting), so resolve it to
  // the effective base level before matching. A remaining level not offered by
  // this menu (e.g. a legacy/inherited 'soft' on a DM) would otherwise leave no
  // row checked.
  const effectiveLevel = rawLevel === 'default' ? baseVolume : rawLevel;
  const currentLevel = normalizeLevelToOptions(effectiveLevel, options);

  return { currentLevel, options, updateVolume };
}
