import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import React, { PropsWithChildren, useCallback, useMemo } from 'react';
import { XStack, YStack, styled } from 'tamagui';

import { useCalm } from '../../contexts/appDataContext';
import { getGroupTitle, useChannelTitle, useGroupTitle } from '../../utils';
import { ChannelAvatar, ContactAvatar } from '../Avatar';
import { GroupAvatar } from '../GroupAvatar';
import { UnreadDot } from '../UnreadDot';
import { ActivitySourceContent } from './ActivitySourceContent';
import { SummaryMessage } from './ActivitySummaryMessage';

export const ActivityListItem = React.memo(function ActivityListItem({
  sourceActivity,
  seenMarker,
  onPress,
}: {
  sourceActivity: logic.SourceActivityEvents;
  seenMarker: number;
  onPress: (event: db.ActivityEvent) => void;
}) {
  const event = sourceActivity.newest;
  const handlePress = useCallback(() => onPress(event), [event, onPress]);

  if (
    event.type === 'post' ||
    event.type === 'reply' ||
    event.type === 'react' ||
    event.type === 'flag-post' ||
    event.type === 'flag-reply' ||
    event.type === 'group-ask' ||
    event.type === 'contact' ||
    event.type === 'note-create' ||
    event.type === 'note-edit'
  ) {
    return (
      <Pressable onPress={handlePress}>
        <ActivityListItemContent
          summary={sourceActivity}
          pressHandler={handlePress}
          seenMarker={seenMarker}
        />
      </Pressable>
    );
  }

  return <Text size="$label/m"> Event type {event.type} not supported</Text>;
});

export function ActivityListItemContent({
  summary,
  pressHandler,
  seenMarker,
}: {
  summary: logic.SourceActivityEvents;
  pressHandler?: () => void;
  seenMarker: number;
}) {
  const calm = useCalm();
  const newestPost = summary.newest;
  const group = newestPost.group ?? undefined;
  const channel: db.Channel | undefined = newestPost.channel ?? undefined;
  const modelUnread = useMemo(() => {
    if (summary.type === 'note-create' || summary.type === 'note-edit') {
      // a note's unread rides a thread row keyed by the note id (postId);
      // the channel rollup would keep this item lit for *other* unread notes
      return newestPost.channelId && newestPost.postId
        ? ({
            channelId: newestPost.channelId,
            threadId: newestPost.postId,
          } as db.ThreadUnreadState)
        : null;
    }
    if (summary.type === 'post') {
      return newestPost.channel?.unread ?? null;
    }
    if (summary.type === 'group-ask') {
      return newestPost.group?.unread ?? null;
    }
    return newestPost.parent?.threadUnread ?? null;
  }, [summary.type, newestPost]);
  const { data: unread } = store.useLiveUnread(modelUnread);
  const unreadCount = useMemo(() => {
    return (isGroupUnread(unread) ? unread.notifyCount : unread?.count) ?? 0;
  }, [unread]);

  const groupTitle = useGroupTitle(group ?? null);
  const channelTitle = useChannelTitle(channel ?? null);
  const title = useMemo(() => {
    if (channel == null || channelTitle == null) {
      return groupTitle ?? '';
    }
    if (channel.type === 'dm') {
      return 'Direct message';
    }
    if (channel.type === 'groupDm') {
      return 'Group chat';
    }
    return `${groupTitle}: ${channelTitle}`;
  }, [channel, channelTitle, groupTitle]);

  return (
    <ActivitySummaryFrame
      backgroundColor={
        summary.newest.timestamp > seenMarker ? '$positiveBackground' : 'unset'
      }
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      onPress={pressHandler}
    >
      <ContactAvatar
        size="$3.5xl"
        innerSigilSize={16}
        contactId={
          newestPost.authorId ??
          newestPost.groupEventUserId ??
          newestPost.contactUserId ??
          ''
        }
      />
      <ActivitySummaryContent>
        <ActivitySummaryHeader
          unreadCount={unreadCount}
          title={title}
          sentTime={newestPost.timestamp}
        >
          <ActivitySummaryTitleIcon channel={channel} group={group} />
        </ActivitySummaryHeader>

        <YStack>
          <SummaryMessage summary={summary} />
          {!['group-ask', 'react'].includes(summary.type) ? (
            <ActivitySourceContent
              summary={summary}
              pressHandler={pressHandler}
              unreadCount={unreadCount}
            />
          ) : null}
        </YStack>
      </ActivitySummaryContent>
    </ActivitySummaryFrame>
  );
}

function ActivitySummaryTitleIcon({
  channel,
  group,
}: {
  channel?: db.Channel | null;
  group?: db.Group | null;
}) {
  return group ? (
    channel ? (
      <ChannelAvatar size="$xl" model={{ ...channel, group }} />
    ) : (
      <GroupAvatar size="$xl" model={group} />
    )
  ) : (
    <Icon type="ChannelDM" customSize={['$l', '$l']} color="$tertiaryText" />
  );
}

function ActivitySummaryHeader({
  title,
  unreadCount,
  sentTime,
  children,
}: PropsWithChildren<{
  title: string;
  unreadCount: number;
  sentTime?: number;
}>) {
  return (
    <XStack alignItems="center" gap="$s">
      {unreadCount || children ? (
        <XStack alignItems="center" gap="$s">
          {unreadCount ? <UnreadDot /> : null}
          {children}
        </XStack>
      ) : null}
      <Text size="$label/m" color="$tertiaryText">
        {title}
      </Text>
      {sentTime && (
        <Text size="$label/m" color="$tertiaryText">
          {logic.makePrettyTime(new Date(sentTime))}
        </Text>
      )}
    </XStack>
  );
}

export const ActivitySummaryFrame = styled(XStack, {
  padding: '$l',
  gap: '$l',
  borderRadius: '$xl',
});

export const ActivitySummaryContent = styled(YStack, {
  paddingTop: '$xs',
  gap: '$2xs',
  flex: 1,
});

function isGroupUnread(
  unread?: db.GroupUnread | db.ChannelUnread | db.ThreadUnreadState | null
): unread is db.GroupUnread {
  return !!unread && 'groupId' in unread;
}
