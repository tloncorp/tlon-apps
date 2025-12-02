import * as ub from '@tloncorp/shared/urbit';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { RadioInput, RadioInputOption } from './Form/inputs';

export type NotificationLevelOptionsConfig = {
  includeLoud?: boolean;
  shortDescriptions?: boolean;
};

export function useNotificationLevelOptions(
  config: NotificationLevelOptionsConfig = {}
) {
  const { includeLoud = false, shortDescriptions = false } = config;
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  return useMemo<RadioInputOption<ub.NotificationLevel>[]>(() => {
    const options: RadioInputOption<ub.NotificationLevel>[] = [];

    // 'loud' level is only available for individual channel/group overrides
    if (includeLoud) {
      options.push({
        title: 'All activity',
        value: 'loud' as ub.NotificationLevel,
        description: shortDescriptions
          ? undefined
          : 'Notify for all activity in this channel or group.',
      });
    }

    // 'medium' level is available for both base settings and overrides
    options.push({
      title: includeLoud
        ? 'Posts, mentions, and replies'
        : 'All group activity',
      value: 'medium' as ub.NotificationLevel,
      description: shortDescriptions
        ? undefined
        : 'Notify for all posts, mentions, and replies in groups. Direct messages always notify unless muted.',
    });

    // 'soft' level is available for both base settings and overrides
    options.push({
      title: includeLoud ? 'DMs, mentions, and replies' : 'DMs, mentions, and replies only',
      value: 'soft' as ub.NotificationLevel,
      description: shortDescriptions
        ? undefined
        : 'Notify only when someone mentions you or replies to your posts. Direct messages always notify unless muted.',
    });

    // 'hush' level is available for both base settings and overrides
    options.push({
      title: 'Nothing',
      value: 'hush' as ub.NotificationLevel,
      description: shortDescriptions
        ? undefined
        : isNative
          ? 'No notifications for anything, even if push notifications are enabled on your device.'
          : 'No notifications for anything.',
    });

    return options;
  }, [includeLoud, shortDescriptions, isNative]);
}

export function NotificationLevelSelector({
  value,
  onChange,
  config,
}: {
  value: ub.NotificationLevel;
  onChange: (level: ub.NotificationLevel) => void;
  config?: NotificationLevelOptionsConfig;
}) {
  const options = useNotificationLevelOptions(config);

  return <RadioInput options={options} value={value} onChange={onChange} />;
}
