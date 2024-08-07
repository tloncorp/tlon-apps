import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import { useMemo } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { getChannelTitle } from '../../utils';
import { ChannelAvatar, ContactAvatar } from '../Avatar';
import { ActivitySourceContent } from './ActivitySourceContent';
import { ActivitySummaryHeader } from './ActivitySummaryHeader';
import { SummaryMessage } from './ActivitySummaryMessage';

export function ChannelActivitySummary({
  summary,
  seenMarker,
  pressHandler,
}: {
  summary: logic.SourceActivityEvents;
  seenMarker: number;
  pressHandler?: () => void;
}) {
  const newestPost = summary.newest;
  const group = newestPost.group ?? undefined;
  const channel: db.Channel | undefined = newestPost.channel ?? undefined;
  const modelUnread =
    summary.type === 'post'
      ? newestPost.channel?.unread ?? null
      : newestPost.parent?.threadUnread ?? null;
  const { data: unread } = store.useLiveUnread(modelUnread);
  const unreadCount = useMemo(() => unread?.count ?? 0, [unread]);

  const newestIsBlockOrNote =
    (summary.type === 'post' && newestPost.channel?.type === 'gallery') ||
    newestPost.channel?.type === 'notebook';
  const title = !channel
    ? ''
    : channel.type === 'dm'
      ? 'DM'
      : channel.type === 'groupDm'
        ? 'Group chat'
        : getChannelTitle(channel);

  return (
    <View
      padding="$l"
      marginBottom="$l"
      backgroundColor={
        newestPost.timestamp > seenMarker && unreadCount > 0
          ? '$positiveBackground'
          : 'unset'
      }
      borderRadius="$l"
      onPress={newestIsBlockOrNote ? undefined : pressHandler}
    >
      <XStack>
        <ContactAvatar
          contactId={newestPost.authorId ?? ''}
          size="$3xl"
          innerSigilSize={14}
        />
        <YStack marginLeft="$m">
          {channel && (
            <ActivitySummaryHeader
              unreadCount={unreadCount}
              title={title}
              sentTime={newestPost.timestamp}
            >
              {group && (
                <ChannelAvatar size="$xl" model={{ ...channel, group }} />
              )}
            </ActivitySummaryHeader>
          )}
          <View>
            <SummaryMessage summary={summary} />
          </View>
          <ActivitySourceContent
            summary={summary}
            pressHandler={pressHandler}
          />
        </YStack>
      </XStack>
    </View>
  );
}
