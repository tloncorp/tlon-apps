import type * as ub from '@tloncorp/api/urbit';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

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
  const isInheriting = rawLevel === 'default';
  const effectiveLevel = isInheriting ? baseVolume : rawLevel;
  const currentLevel = normalizeLevelToOptions(effectiveLevel, options);

  // While inheriting, the checked row only reflects the inherited default.
  // Re-tapping it must keep inheriting rather than pin a concrete override —
  // otherwise future app-default changes would stop applying to this chat.
  const setVolume = useCallback(
    async (level: ub.NotificationLevel | null) => {
      if (isInheriting && level === currentLevel) {
        return;
      }
      await updateVolume(level);
    },
    [isInheriting, currentLevel, updateVolume]
  );

  return { currentLevel, options, updateVolume: setVolume };
}
