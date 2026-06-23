import * as ub from '@tloncorp/api/urbit';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { RadioInput, RadioInputOption } from './Form/inputs';

// 'base' is the app-wide default (covers DMs and groups); 'group' and
// 'channel' are per-group/channel volume overrides that don't affect DMs;
// 'dm' is a per-DM override.
export type NotificationLevelContext = 'base' | 'group' | 'channel' | 'dm';

// Derives the volume-menu context for a per-chat override. With no channel
// it's a group override; a DM/group-DM channel keeps DM labels; anything else
// is a group channel.
export function getNotificationLevelContext(
  channel?: { id?: string | null; type?: string | null } | null
): NotificationLevelContext {
  if (!channel?.id) {
    return 'group';
  }
  return channel.type === 'dm' || channel.type === 'groupDm' ? 'dm' : 'channel';
}

export type NotificationLevelOptionsConfig = {
  includeLoud?: boolean;
  shortDescriptions?: boolean;
  context?: NotificationLevelContext;
};

// Levels shown for each context, in display order. 'loud' is dropped when
// `includeLoud` is false (base settings). DMs have no posts/mentions/replies
// distinction, so they get a simple all-or-nothing choice.
const CONTEXT_LEVELS: Record<NotificationLevelContext, ub.NotificationLevel[]> =
  {
    base: ['loud', 'medium', 'soft', 'hush'],
    group: ['loud', 'medium', 'soft', 'hush'],
    channel: ['loud', 'medium', 'soft', 'hush'],
    dm: ['medium', 'hush'],
  };

// Per-context titles for each level.
const LEVEL_TITLES: Record<
  NotificationLevelContext,
  Partial<Record<ub.NotificationLevel, string>>
> = {
  base: {
    loud: 'All activity',
    medium: 'All DMs and group posts',
    soft: 'DMs, mentions, and replies only',
    hush: 'Nothing',
  },
  group: {
    loud: 'All group activity',
    medium: 'Group posts, mentions, and replies',
    soft: 'Mentions and replies',
    hush: 'Nothing',
  },
  channel: {
    loud: 'All channel activity',
    medium: 'Channel posts, mentions, and replies',
    soft: 'Mentions and replies',
    hush: 'Nothing',
  },
  dm: {
    medium: 'All messages',
    hush: 'Nothing',
  },
};

// Long-form descriptions keyed by level. 'medium' in a DM and 'hush' on/off
// native are special-cased in getLevelDescription.
const LEVEL_DESCRIPTIONS: Partial<Record<ub.NotificationLevel, string>> = {
  loud: 'Notify for all activity in this channel or group.',
  medium:
    'Notify for all posts, mentions, and replies in groups. Direct messages always notify unless muted.',
  soft: 'Notify only when someone mentions you or replies to your posts. Direct messages always notify unless muted.',
};

const DM_MEDIUM_DESCRIPTION = 'Notify for every message in this conversation.';
const HUSH_DESCRIPTION_NATIVE =
  'No notifications for anything, even if push notifications are enabled on your device.';
const HUSH_DESCRIPTION_WEB = 'No notifications for anything.';

function getLevelTitle(
  level: ub.NotificationLevel,
  context: NotificationLevelContext
): string {
  return LEVEL_TITLES[context][level] ?? '';
}

function getLevelDescription(
  level: ub.NotificationLevel,
  context: NotificationLevelContext,
  isNative: boolean,
  shortDescriptions: boolean
): string | undefined {
  if (shortDescriptions) {
    return undefined;
  }
  if (level === 'hush') {
    return isNative ? HUSH_DESCRIPTION_NATIVE : HUSH_DESCRIPTION_WEB;
  }
  if (level === 'medium' && context === 'dm') {
    return DM_MEDIUM_DESCRIPTION;
  }
  return LEVEL_DESCRIPTIONS[level];
}

export function useNotificationLevelOptions(
  config: NotificationLevelOptionsConfig = {}
) {
  const {
    includeLoud = false,
    shortDescriptions = false,
    context = 'base',
  } = config;
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  return useMemo<RadioInputOption<ub.NotificationLevel>[]>(
    () =>
      CONTEXT_LEVELS[context]
        .filter((level) => includeLoud || level !== 'loud')
        .map((value) => ({
          value,
          title: getLevelTitle(value, context),
          description: getLevelDescription(
            value,
            context,
            isNative,
            shortDescriptions
          ),
        })),
    [includeLoud, shortDescriptions, isNative, context]
  );
}

// An explicit stored level may not appear in the current menu — e.g. a DM that
// carries a legacy 'soft'/'loud' override, while the DM menu only offers
// all-or-nothing. Map such a level to a displayed option so the menu always
// shows a checked row: a notifying level collapses to the most permissive
// offered option, 'hush' (muted) is always available. Purely presentational —
// the stored value only changes when the user taps.
//
// 'default' is the "inherit from parent/base" sentinel, not an explicit level,
// so it is left unnormalized rather than collapsed (which would misrepresent
// an inherited setting as a stronger explicit override). Callers should
// resolve 'default' to the effective inherited level before normalizing.
export function normalizeLevelToOptions(
  level: ub.NotificationLevel | null | undefined,
  options: RadioInputOption<ub.NotificationLevel>[]
): ub.NotificationLevel | null | undefined {
  if (
    !level ||
    level === 'default' ||
    options.some((option) => option.value === level)
  ) {
    return level;
  }
  const fallback = options.find((option) => option.value !== 'hush');
  return fallback?.value ?? level;
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
