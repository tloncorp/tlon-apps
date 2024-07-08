import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';

import { SizableText, View, XStack, YStack } from '../../core';
import { getChannelTitle } from '../../utils';
import { ChannelAvatar, ContactAvatar } from '../Avatar';
import { UnreadDot } from '../UnreadDot';
import { ActivitySourceContent } from './ActivitySourceContent';
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
  const unreadCount =
    summary.type === 'post'
      ? newestPost.channel?.unread?.countWithoutThreads ?? 0
      : newestPost.parent?.threadUnread?.count ?? 0;

  const newestIsBlockOrNote =
    (summary.type === 'post' && newestPost.channel?.type === 'gallery') ||
    newestPost.channel?.type === 'notebook';

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
            <ChannelIndicator
              unreadCount={unreadCount}
              channel={channel}
              group={group}
              sentTime={newestPost.timestamp}
            />
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

export function ChannelIndicator({
  channel,
  group,
  unreadCount,
  sentTime,
}: {
  channel: db.Channel;
  group?: db.Group;
  unreadCount: number;
  sentTime?: number;
}) {
  const title =
    channel.type === 'dm'
      ? 'DM'
      : channel.type === 'groupDm'
        ? 'Group chat'
        : getChannelTitle(channel);

  return (
    <XStack alignItems="center" gap="$s">
      {unreadCount || group ? (
        <XStack alignItems="center" gap="$s">
          {unreadCount ? <UnreadDot /> : null}
          {group && <ChannelAvatar size="$xl" model={{ ...channel, group }} />}
        </XStack>
      ) : null}
      <SizableText fontSize="$s" color="$secondaryText">
        {title}
      </SizableText>
      {sentTime && (
        <SizableText fontSize="$s" color="$secondaryText">
          {logic.makePrettyTime(new Date(sentTime))}
        </SizableText>
      )}
    </XStack>
  );
}
